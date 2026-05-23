import { Image as ImageIcon, ExternalLink } from "lucide-react";
import { TokenAsset, formatAddress } from "@/lib/solana-api";

interface NFTGalleryProps {
  assets: TokenAsset[];
}

export function NFTGallery({ assets }: NFTGalleryProps) {
  const nfts = assets.filter(
    (a) => a.interface === 'V1_NFT' || a.interface === 'ProgrammableNFT'
  );

  if (nfts.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No NFTs found in this wallet</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.3s' }}>
      <div className="p-4 md:p-6 border-b border-border">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          NFT Collection
          <span className="text-sm font-normal text-muted-foreground">({nfts.length})</span>
        </h3>
      </div>
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {nfts.slice(0, 20).map((nft, index) => (
            <NFTCard key={nft.id} nft={nft} index={index} />
          ))}
        </div>
        {nfts.length > 20 && (
          <p className="text-center text-muted-foreground mt-4">
            +{nfts.length - 20} more NFTs
          </p>
        )}
      </div>
    </div>
  );
}

interface NFTCardProps {
  nft: TokenAsset;
  index: number;
}

function NFTCard({ nft, index }: NFTCardProps) {
  const name = nft.content?.metadata?.name || 'Unnamed NFT';
  const image = nft.content?.links?.image;

  return (
    <div 
      className="group relative rounded-xl overflow-hidden bg-muted aspect-square hover:scale-105 transition-transform duration-300"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {image ? (
        <img 
          src={image} 
          alt={name} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{formatAddress(nft.id, 4)}</p>
      </div>
    </div>
  );
}
