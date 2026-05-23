import { useState, useEffect } from "react";
import { Calculator, DollarSign, Percent, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const StakingCalculator = () => {
  const [amount, setAmount] = useState("1000");
  const [apy, setApy] = useState(7);
  const [duration, setDuration] = useState(12);
  const [solPrice] = useState(143); // Current SOL price approximation
  
  const [rewards, setRewards] = useState({
    daily: 0,
    monthly: 0,
    yearly: 0,
    totalValue: 0,
  });

  useEffect(() => {
    const principal = parseFloat(amount) || 0;
    const rate = apy / 100;
    
    // Simple interest calculation for staking
    const dailyRate = rate / 365;
    const monthlyRate = rate / 12;
    
    const dailyReward = principal * dailyRate;
    const monthlyReward = principal * monthlyRate;
    const yearlyReward = principal * rate;
    
    // Compound calculation for duration
    const totalValue = principal * Math.pow(1 + monthlyRate, duration);
    
    setRewards({
      daily: dailyReward,
      monthly: monthlyReward,
      yearly: yearlyReward,
      totalValue: totalValue,
    });
  }, [amount, apy, duration]);

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Staking Calculator
        </CardTitle>
        <p className="text-sm text-muted-foreground">Calculate your staking rewards</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount Input */}
        <div className="space-y-2">
          <Label>Stake Amount (SOL)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10"
              placeholder="Enter SOL amount"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ≈ ${((parseFloat(amount) || 0) * solPrice).toLocaleString()} USD
          </p>
        </div>

        {/* APY Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>APY</Label>
            <span className="text-sm font-medium text-primary">{apy}%</span>
          </div>
          <Slider
            value={[apy]}
            onValueChange={(v) => setApy(v[0])}
            min={1}
            max={20}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground">
            Current Solana staking APY: ~7%
          </p>
        </div>

        {/* Duration Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Duration (Months)</Label>
            <span className="text-sm font-medium">{duration} months</span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={(v) => setDuration(v[0])}
            min={1}
            max={60}
            step={1}
          />
        </div>

        {/* Results */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h4 className="font-medium">Estimated Rewards</h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Daily</p>
              <p className="font-bold text-primary">{rewards.daily.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground">
                ${(rewards.daily * solPrice).toFixed(2)}
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Monthly</p>
              <p className="font-bold text-primary">{rewards.monthly.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground">
                ${(rewards.monthly * solPrice).toFixed(2)}
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">Yearly</p>
              <p className="font-bold text-primary">{rewards.yearly.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground">
                ${(rewards.yearly * solPrice).toFixed(2)}
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/20 to-secondary/20">
              <p className="text-xs text-muted-foreground mb-1">After {duration}mo</p>
              <p className="font-bold text-primary">{rewards.totalValue.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground">
                ${(rewards.totalValue * solPrice).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
