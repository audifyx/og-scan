import { useState, useEffect } from "react";
import { AlertTriangle, DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const ImpermanentLossCalculator = () => {
  const [initialInvestment, setInitialInvestment] = useState("1000");
  const [priceChange, setPriceChange] = useState(50);
  
  const [results, setResults] = useState({
    impermanentLoss: 0,
    lpValue: 0,
    holdValue: 0,
    actualLoss: 0,
  });

  useEffect(() => {
    const investment = parseFloat(initialInvestment) || 0;
    const priceRatio = 1 + (priceChange / 100);
    
    // Impermanent loss formula: 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
    const ilPercent = (2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1) * 100;
    
    // Calculate values
    // If holding: half stays same, half changes with price
    const holdValue = investment * (0.5 + 0.5 * priceRatio);
    
    // LP value after IL
    const lpValue = holdValue * (1 + ilPercent / 100);
    
    // Actual dollar loss
    const actualLoss = holdValue - lpValue;
    
    setResults({
      impermanentLoss: Math.abs(ilPercent),
      lpValue,
      holdValue,
      actualLoss,
    });
  }, [initialInvestment, priceChange]);

  return (
    <Card className="og-glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Impermanent Loss Calculator
        </CardTitle>
        <p className="text-sm text-muted-foreground">Calculate potential LP losses</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Initial Investment */}
        <div className="space-y-2">
          <Label>Initial LP Investment (USD)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(e.target.value)}
              className="pl-10"
              placeholder="Enter investment amount"
            />
          </div>
        </div>

        {/* Price Change Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Price Change</Label>
            <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange}%
            </span>
          </div>
          <Slider
            value={[priceChange]}
            onValueChange={(v) => setPriceChange(v[0])}
            min={-90}
            max={500}
            step={5}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-90%</span>
            <span>0%</span>
            <span>+500%</span>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="font-medium">Results</h4>
          
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center justify-between">
              <span className="text-sm">Impermanent Loss</span>
              <span className="text-xl font-bold text-red-500">
                {results.impermanentLoss.toFixed(2)}%
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">If Holding</span>
              </div>
              <p className="font-bold">${results.holdValue.toFixed(2)}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs">LP Value</span>
              </div>
              <p className="font-bold">${results.lpValue.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dollar Loss vs Holding</span>
              <span className="font-bold text-yellow-500">
                -${Math.abs(results.actualLoss).toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: This doesn't account for trading fees earned, which can offset IL.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
