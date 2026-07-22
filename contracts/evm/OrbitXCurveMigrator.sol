// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/*
    OrbitX Curve Migrator — graduation -> DEX liquidity.

    When an OrbitXCurveToken graduates, its reserved LP tokens + raised native
    are locked in the curve until its immutable `migrator` pulls them. This
    ownerless contract IS that migrator: it deploys deterministically (CREATE2,
    no constructor args -> same address on every chain), so set
    VITE_ORBITX_CURVE_MIGRATOR to this address and bake it into the factory.

    migrate() is permissionless: anyone can trigger it once the token has
    graduated. It pulls the liquidity, seeds a Uniswap-v2-style pool via
    addLiquidityETH, and sends the LP tokens to the burn address (liquidity
    locked forever). Native dust is refunded to the caller.

    UNAUDITED — audit before mainnet use. Router must be a trusted v2 router for
    the target chain (frontend supplies it from per-chain config).
*/

interface IOrbitXCurveToken {
    function pullLiquidity(address to) external;
    function graduated() external view returns (bool);
    function migrator() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IUniswapV2Router {
    function addLiquidityETH(
        address token, uint256 amountTokenDesired, uint256 amountTokenMin,
        uint256 amountETHMin, address to, uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
    function WETH() external view returns (address);
}

contract OrbitXCurveMigrator {
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    event Migrated(address indexed token, address indexed router, uint256 amountToken, uint256 amountETH, uint256 liquidity);

    uint256 private _lock = 1;
    modifier nonReentrant() { require(_lock == 1, "reentrancy"); _lock = 2; _; _lock = 1; }

    /// Seed a v2 pool from a graduated curve. Permissionless once graduated.
    function migrate(address token, address router, uint256 minTokenLP, uint256 minEthLP)
        external nonReentrant returns (uint256 liquidity)
    {
        IOrbitXCurveToken t = IOrbitXCurveToken(token);
        require(t.migrator() == address(this), "not this migrator");
        require(t.graduated(), "not graduated");
        require(router != address(0), "no router");

        t.pullLiquidity(address(this));

        uint256 tokenBal = t.balanceOf(address(this));
        uint256 ethBal = address(this).balance;
        require(tokenBal > 0 && ethBal > 0, "nothing to migrate");

        require(t.approve(router, tokenBal), "approve failed");
        uint256 amountToken;
        uint256 amountETH;
        (amountToken, amountETH, liquidity) = IUniswapV2Router(router).addLiquidityETH{value: ethBal}(
            token, tokenBal, minTokenLP, minEthLP, BURN, block.timestamp + 1200
        );

        // clear residual allowance and refund native dust to the caller
        t.approve(router, 0);
        uint256 dust = address(this).balance;
        if (dust > 0) {
            (bool ok, ) = payable(msg.sender).call{value: dust}("");
            require(ok, "refund failed");
        }
        emit Migrated(token, router, amountToken, amountETH, liquidity);
    }

    receive() external payable {}
}
