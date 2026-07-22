// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    OrbitX Curve (EVM) — open, self-authored pump-style bonding curve.

    This is OrbitX's OWN implementation. It is NOT derived from, and does not
    copy, any third-party launchpad's source (Pons/flap.sh/etc.). The economics
    (fixed supply, virtual-reserve constant-product pricing, graduation to a DEX
    pool) are the well-known public "pump.fun" model, re-implemented from first
    principles under the MIT license.

    Keyless by design: the factory has no owner and no admin key. Each curve
    token is immutable once deployed. Platform + creator fee recipients and the
    graduation migrator are fixed at deploy time via constructor args (so a
    CREATE2 deterministic deploy lands at the same address on every chain only
    when the args match).

    UNAUDITED. Ship to a real mainnet only after an external audit and per-chain
    testing. The frontend registers this provider as "beta" for that reason.
//////////////////////////////////////////////////////////////////////////*/

/// Minimal ERC-20 whose entire supply is minted to itself and sold along a
/// bonding curve. No owner, no mint, no pause.
abstract contract CurveERC20 {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        unchecked { balanceOf[to] += value; }
        emit Transfer(address(0), to, value);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= value, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "zero address");
        uint256 b = balanceOf[from];
        require(b >= value, "balance");
        unchecked {
            balanceOf[from] = b - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}

/// A single launched token + its bonding-curve market, in one immutable contract.
contract OrbitXCurveToken is CurveERC20 {
    // ---- immutable market config (set by factory) ----
    address public immutable creator;
    address public immutable platform;     // platform fee recipient
    address public immutable migrator;      // may pull LP funds after graduation (0 = locked)
    uint16  public immutable feeBps;        // total trade fee, e.g. 100 = 1.00%
    uint16  public immutable creatorFeeBps; // portion of feeBps routed to creator
    uint256 public immutable virtualNative; // virtual native reserve (pricing only)
    uint256 public immutable graduationNative; // real native raised that triggers graduation

    // ---- market state ----
    uint256 public tokenReserve;  // tokens still purchasable on the curve
    uint256 public realNative;    // real native collected from buyers (withdrawable value)
    uint256 public lpTokens;      // tokens reserved for the DEX pool at graduation
    bool    public graduated;

    uint256 private _lock = 1;
    modifier nonReentrant() { require(_lock == 1, "reentrancy"); _lock = 2; _; _lock = 1; }

    event Buy(address indexed buyer, uint256 nativeIn, uint256 tokensOut, uint256 newPriceX1e18);
    event Sell(address indexed seller, uint256 tokensIn, uint256 nativeOut, uint256 newPriceX1e18);
    event Graduated(uint256 realNative, uint256 lpTokens);
    event LiquidityPulled(address indexed to, uint256 nativeAmount, uint256 tokenAmount);

    constructor(
        string memory _name,
        string memory _symbol,
        address _creator,
        address _platform,
        address _migrator,
        uint16  _feeBps,
        uint16  _creatorFeeBps,
        uint256 _totalSupply,
        uint256 _curveSupply,
        uint256 _virtualNative,
        uint256 _graduationNative
    ) {
        require(_feeBps <= 1000, "fee too high");           // hard cap 10%
        require(_creatorFeeBps <= _feeBps, "creator>fee");
        require(_curveSupply > 0 && _curveSupply <= _totalSupply, "bad curve supply");
        require(_virtualNative > 0 && _graduationNative > 0, "bad curve params");

        name = _name;
        symbol = _symbol;
        creator = _creator;
        platform = _platform;
        migrator = _migrator;
        feeBps = _feeBps;
        creatorFeeBps = _creatorFeeBps;
        virtualNative = _virtualNative;
        graduationNative = _graduationNative;

        _mint(address(this), _totalSupply);
        tokenReserve = _curveSupply;
        lpTokens = _totalSupply - _curveSupply; // reserved, not sellable on the curve
    }

    /// Spot price in native per token, scaled by 1e18.
    function priceX1e18() public view returns (uint256) {
        if (tokenReserve == 0) return type(uint256).max;
        return ((virtualNative + realNative) * 1e18) / tokenReserve;
    }

    /// Quote tokens out for a given net (post-fee) native in.
    function _tokensOut(uint256 netIn) internal view returns (uint256) {
        uint256 x = virtualNative + realNative;
        uint256 y = tokenReserve;
        // dy = y * netIn / (x + netIn)  (constant product x*y=k)
        return (y * netIn) / (x + netIn);
    }

    /// Quote gross native out (pre-fee) for a given token amount in.
    function _nativeOut(uint256 tokensIn) internal view returns (uint256) {
        uint256 x = virtualNative + realNative;
        uint256 y = tokenReserve;
        return (x * tokensIn) / (y + tokensIn);
    }

    function _splitFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 toCreator = (fee * creatorFeeBps) / feeBps;
        uint256 toPlatform = fee - toCreator;
        if (toCreator > 0) _pay(creator, toCreator);
        if (toPlatform > 0) _pay(platform, toPlatform);
    }

    function _pay(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "native transfer failed");
    }

    /// Buy tokens from the curve. `minTokensOut` guards against slippage.
    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        require(!graduated, "graduated");
        require(msg.value > 0, "no value");
        uint256 fee = (msg.value * feeBps) / 10000;
        uint256 netIn = msg.value - fee;

        tokensOut = _tokensOut(netIn);
        require(tokensOut >= minTokensOut, "slippage");
        require(tokensOut > 0 && tokensOut <= tokenReserve, "insufficient curve supply");

        tokenReserve -= tokensOut;
        realNative += netIn;

        _splitFee(fee);
        _transfer(address(this), msg.sender, tokensOut);
        emit Buy(msg.sender, msg.value, tokensOut, priceX1e18());

        if (realNative >= graduationNative) _graduate();
    }

    /// Sell tokens back to the curve. `minNativeOut` guards against slippage.
    function sell(uint256 tokenAmount, uint256 minNativeOut) external nonReentrant returns (uint256 nativeOut) {
        require(!graduated, "graduated");
        require(tokenAmount > 0, "no tokens");

        uint256 gross = _nativeOut(tokenAmount);
        require(gross <= realNative, "curve lacks native");
        uint256 fee = (gross * feeBps) / 10000;
        nativeOut = gross - fee;
        require(nativeOut >= minNativeOut, "slippage");

        // pull tokens first (checks-effects-interactions)
        _transfer(msg.sender, address(this), tokenAmount);
        tokenReserve += tokenAmount;
        realNative -= gross;

        _splitFee(fee);
        _pay(msg.sender, nativeOut);
        emit Sell(msg.sender, tokenAmount, nativeOut, priceX1e18());
    }

    function _graduate() internal {
        graduated = true;
        emit Graduated(realNative, lpTokens);
    }

    /// After graduation, the fixed migrator can move the raised native + reserved
    /// LP tokens into a DEX pool. If migrator is address(0), funds stay locked.
    function pullLiquidity(address to) external nonReentrant {
        require(graduated, "not graduated");
        require(migrator != address(0) && msg.sender == migrator, "not migrator");
        uint256 nativeAmount = realNative;
        uint256 tokenAmount = lpTokens;
        realNative = 0;
        lpTokens = 0;
        if (tokenAmount > 0) _transfer(address(this), to, tokenAmount);
        if (nativeAmount > 0) _pay(to, nativeAmount);
        emit LiquidityPulled(to, nativeAmount, tokenAmount);
    }

    // ---- view helpers for the frontend ----
    function quoteBuy(uint256 nativeIn) external view returns (uint256 tokensOut, uint256 fee) {
        fee = (nativeIn * feeBps) / 10000;
        tokensOut = _tokensOut(nativeIn - fee);
    }

    function quoteSell(uint256 tokenAmount) external view returns (uint256 nativeOut, uint256 fee) {
        uint256 gross = _nativeOut(tokenAmount);
        fee = (gross * feeBps) / 10000;
        nativeOut = gross - fee;
    }

    function marketState() external view returns (
        uint256 _tokenReserve, uint256 _realNative, uint256 _virtualNative,
        uint256 _graduationNative, bool _graduated, uint256 _price
    ) {
        return (tokenReserve, realNative, virtualNative, graduationNative, graduated, priceX1e18());
    }
}

/// Ownerless factory. Anyone can launch a curve token straight from their wallet.
contract OrbitXCurveFactory {
    // fixed, immutable platform economics baked in at factory deploy
    address public immutable platform;
    address public immutable migrator;
    uint16  public immutable feeBps;
    uint16  public immutable creatorFeeBps;
    uint256 public immutable totalSupply_;
    uint256 public immutable curveSupply_;
    uint256 public immutable virtualNative_;
    uint256 public immutable graduationNative_;

    address[] public allTokens;

    event TokenLaunched(
        address indexed token, address indexed creator,
        string name, string symbol, uint256 initialBuyNative
    );

    constructor(
        address _platform,
        address _migrator,
        uint16  _feeBps,
        uint16  _creatorFeeBps,
        uint256 _totalSupply,
        uint256 _curveSupply,
        uint256 _virtualNative,
        uint256 _graduationNative
    ) {
        platform = _platform;
        migrator = _migrator;
        feeBps = _feeBps;
        creatorFeeBps = _creatorFeeBps;
        totalSupply_ = _totalSupply;
        curveSupply_ = _curveSupply;
        virtualNative_ = _virtualNative;
        graduationNative_ = _graduationNative;
    }

    function tokenCount() external view returns (uint256) { return allTokens.length; }

    /// Launch a token; any attached native is used as the creator's first buy.
    function launch(string calldata name, string calldata symbol)
        external payable returns (address token)
    {
        OrbitXCurveToken t = new OrbitXCurveToken(
            name, symbol, msg.sender, platform, migrator,
            feeBps, creatorFeeBps, totalSupply_, curveSupply_,
            virtualNative_, graduationNative_
        );
        token = address(t);
        allTokens.push(token);
        emit TokenLaunched(token, msg.sender, name, symbol, msg.value);
        if (msg.value > 0) {
            t.buy{value: msg.value}(0);
            // forward the freshly bought tokens to the creator
            uint256 bal = t.balanceOf(address(this));
            if (bal > 0) t.transfer(msg.sender, bal);
        }
    }
}
