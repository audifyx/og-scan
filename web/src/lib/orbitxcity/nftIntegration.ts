/** 
 * NFT Integration - links in-game assets to blockchain NFTs.
 * Characters, homes, items, and achievements can be minted as NFTs.
 */

export type NFTType = 'character' | 'home' | 'item' | 'badge' | 'avatar-outfit' | 'land';

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS or URL
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

export interface GameNFT {
  id: string; // In-game ID
  contractAddress: string;
  tokenId: string;
  type: NFTType;
  owner: string; // Wallet address
  metadata: NFTMetadata;
  mintedAt: number;
  chainId: number; // 1=Ethereum, 8453=Base, 42161=Arbitrum, etc.
  marketplaceUrl?: string;
  tradeable: boolean;
  royaltyPercentage: number;
}

export interface NFTWallet {
  address: string;
  nfts: GameNFT[];
  totalValue: number; // USD estimate
}

export interface NFTMarketplaceListing {
  id: string;
  nftId: string;
  seller: string;
  price: number; // USD equivalent
  currency: string; // 'ETH', 'SOL', 'CREDITS', etc.
  listedAt: number;
  expiresAt: number;
  sold: boolean;
  soldTo?: string;
  soldPrice?: number;
}

/**
 * NFT integration system.
 */
export class NFTIntegrationSystem {
  private nfts: Map<string, GameNFT> = new Map();
  private wallets: Map<string, NFTWallet> = new Map();
  private marketplaceListings: Map<string, NFTMarketplaceListing> = new Map();
  private nftIdCounter: number = 0;

  /**
   * Mint a new NFT for in-game asset.
   */
  async mintNFT(
    type: NFTType,
    owner: string,
    metadata: NFTMetadata,
    chainId: number = 8453 // Default to Base chain
  ): Promise<GameNFT> {
    const nft: GameNFT = {
      id: `nft-${this.nftIdCounter++}`,
      contractAddress: '0x' + 'a'.repeat(40), // Placeholder
      tokenId: Math.random().toString(36).substring(2),
      type,
      owner,
      metadata,
      mintedAt: Date.now(),
      chainId,
      tradeable: type !== 'character', // Characters usually bound
      royaltyPercentage: 5,
    };

    this.nfts.set(nft.id, nft);

    // Add to owner's wallet
    if (!this.wallets.has(owner)) {
      this.wallets.set(owner, {
        address: owner,
        nfts: [],
        totalValue: 0,
      });
    }

    const wallet = this.wallets.get(owner)!;
    wallet.nfts.push(nft);

    console.log(`[v0] NFT minted: ${metadata.name} for ${owner}`);

    return nft;
  }

  /**
   * Create metadata for character NFT.
   */
  createCharacterMetadata(characterName: string, appearance: any, stats: any): NFTMetadata {
    return {
      name: `OrbitX Character: ${characterName}`,
      description: `A unique character in the OrbitX metaverse with custom appearance and skills.`,
      image: 'ipfs://QmXXXX...', // Would point to actual IPFS
      attributes: [
        { trait_type: 'Level', value: stats.level },
        { trait_type: 'Experience', value: stats.xp },
        { trait_type: 'Reputation', value: stats.reputation },
        { trait_type: 'Body Type', value: appearance.bodyType },
        { trait_type: 'Hair Color', value: appearance.hair.color },
      ],
      external_url: 'https://orbitx.city/character/' + characterName,
    };
  }

  /**
   * Create metadata for home NFT.
   */
  createHomeMetadata(homeName: string, design: any, upgrades: any): NFTMetadata {
    return {
      name: `OrbitX Home: ${homeName}`,
      description: `A customizable home in the OrbitX metaverse with unique design and upgrades.`,
      image: 'ipfs://QmXXXX...', // 3D render
      attributes: [
        { trait_type: 'Layout', value: design.layout },
        { trait_type: 'Theme', value: design.style },
        { trait_type: 'Rooms', value: design.roomCount },
        { trait_type: 'Upgrades', value: Object.keys(upgrades).filter((k) => upgrades[k]).join(',') },
      ],
      external_url: 'https://orbitx.city/home/' + homeName,
    };
  }

  /**
   * Create metadata for achievement/badge NFT.
   */
  createBadgeMetadata(badgeName: string, achievement: string, rarity: string): NFTMetadata {
    return {
      name: `${badgeName}`,
      description: `Achievement unlocked: ${achievement}. This badge represents mastery in the OrbitX ecosystem.`,
      image: `https://orbitx.city/badges/${badgeName.toLowerCase()}.png`,
      attributes: [
        { trait_type: 'Achievement', value: achievement },
        { trait_type: 'Rarity', value: rarity },
        { trait_type: 'Category', value: 'Achievement' },
      ],
    };
  }

  /**
   * List NFT on marketplace.
   */
  listNFTForSale(nftId: string, price: number, currency: string = 'ETH', expiresInDays: number = 30): NFTMarketplaceListing | null {
    const nft = this.nfts.get(nftId);
    if (!nft || !nft.tradeable) {
      console.error('[v0] NFT cannot be listed for sale');
      return null;
    }

    const listing: NFTMarketplaceListing = {
      id: `listing-${Date.now()}`,
      nftId,
      seller: nft.owner,
      price,
      currency,
      listedAt: Date.now(),
      expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      sold: false,
    };

    this.marketplaceListings.set(listing.id, listing);

    console.log(`[v0] NFT listed for sale: ${nft.metadata.name} - ${price} ${currency}`);
    return listing;
  }

  /**
   * Purchase NFT from marketplace.
   */
  purchaseNFT(listingId: string, buyer: string, actualPrice: number): GameNFT | null {
    const listing = this.marketplaceListings.get(listingId);
    if (!listing || listing.sold) {
      console.error('[v0] Listing not available');
      return null;
    }

    const nft = this.nfts.get(listing.nftId);
    if (!nft) {
      console.error('[v0] NFT not found');
      return null;
    }

    // Transfer NFT to buyer
    const previousOwner = nft.owner;
    nft.owner = buyer;

    // Update listing
    listing.sold = true;
    listing.soldTo = buyer;
    listing.soldPrice = actualPrice;

    // Update wallets
    const sellerWallet = this.wallets.get(previousOwner);
    if (sellerWallet) {
      sellerWallet.nfts = sellerWallet.nfts.filter((n) => n.id !== nft.id);
    }

    if (!this.wallets.has(buyer)) {
      this.wallets.set(buyer, { address: buyer, nfts: [], totalValue: 0 });
    }

    const buyerWallet = this.wallets.get(buyer)!;
    buyerWallet.nfts.push(nft);

    console.log(`[v0] NFT purchased: ${nft.metadata.name} by ${buyer} for ${actualPrice}`);
    return nft;
  }

  /**
   * Get user's NFT wallet.
   */
  getUserWallet(address: string): NFTWallet | undefined {
    return this.wallets.get(address);
  }

  /**
   * Get marketplace listings (filtering/sorting).
   */
  getMarketplaceListings(
    nftType?: NFTType,
    maxPrice?: number,
    sortBy: 'price' | 'recent' = 'price'
  ): NFTMarketplaceListing[] {
    let listings = Array.from(this.marketplaceListings.values()).filter((l) => !l.sold);

    // Filter by type
    if (nftType) {
      listings = listings.filter((l) => {
        const nft = this.nfts.get(l.nftId);
        return nft?.type === nftType;
      });
    }

    // Filter by price
    if (maxPrice) {
      listings = listings.filter((l) => l.price <= maxPrice);
    }

    // Sort
    if (sortBy === 'price') {
      listings.sort((a, b) => a.price - b.price);
    } else {
      listings.sort((a, b) => b.listedAt - a.listedAt);
    }

    return listings;
  }

  /**
   * Get floor price for NFT type.
   */
  getFloorPrice(nftType: NFTType): number {
    const listings = Array.from(this.marketplaceListings.values())
      .filter((l) => !l.sold && l.expiresAt > Date.now())
      .map((l) => {
        const nft = this.nfts.get(l.nftId);
        return nft?.type === nftType ? l.price : Infinity;
      })
      .filter((p) => p !== Infinity);

    return listings.length > 0 ? Math.min(...listings) : 0;
  }

  /**
   * Get collection stats.
   */
  getCollectionStats(nftType: NFTType): {
    floorPrice: number;
    totalVolume: number;
    itemsListed: number;
    uniqueOwners: number;
  } {
    const typeNFTs = Array.from(this.nfts.values()).filter((n) => n.type === nftType);
    const listings = this.getMarketplaceListings(nftType);
    const soldListings = Array.from(this.marketplaceListings.values())
      .filter((l) => l.sold && this.nfts.get(l.nftId)?.type === nftType);

    const uniqueOwners = new Set(typeNFTs.map((n) => n.owner)).size;
    const totalVolume = soldListings.reduce((sum, l) => sum + (l.soldPrice || 0), 0);

    return {
      floorPrice: this.getFloorPrice(nftType),
      totalVolume,
      itemsListed: listings.length,
      uniqueOwners,
    };
  }

  dispose() {
    this.nfts.clear();
    this.wallets.clear();
    this.marketplaceListings.clear();
  }
}

/**
 * NFT contract templates for different chains.
 */
export const NFT_CONTRACTS = {
  ethereum: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    name: 'OrbitX Characters (Ethereum)',
  },
  base: {
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    chainId: 8453,
    name: 'OrbitX Characters (Base)',
  },
  arbitrum: {
    address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    chainId: 42161,
    name: 'OrbitX Characters (Arbitrum)',
  },
};
