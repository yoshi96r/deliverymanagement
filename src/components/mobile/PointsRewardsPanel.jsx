import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Star, Gift, TrendingUp, Sparkles, Award, 
  ShoppingBag, DollarSign, Coffee, Fuel
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PointsRewardsPanel({ driverEmail, driverName }) {
  const [selectedReward, setSelectedReward] = useState(null);
  const queryClient = useQueryClient();

  const { data: pointsHistory } = useQuery({
    queryKey: ['driverPoints', driverEmail],
    queryFn: async () => {
      const points = await base44.entities.DriverPoints.filter({
        driver_email: driverEmail
      });
      return points.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
    },
    initialData: [],
  });

  // Calculate current balance
  const currentBalance = pointsHistory.length > 0 
    ? pointsHistory[0].current_balance || 0
    : 0;

  const recentPoints = pointsHistory.slice(0, 10);
  const totalEarned = pointsHistory.reduce((sum, p) => sum + (p.points_earned || 0), 0);

  // Available rewards (in production, these would be entities)
  const rewards = [
    { id: 'gas_10', name: '$10 Gas Card', points: 1000, icon: Fuel, color: 'bg-blue-600' },
    { id: 'coffee_5', name: '$5 Coffee Shop', points: 500, icon: Coffee, color: 'bg-orange-600' },
    { id: 'amazon_25', name: '$25 Amazon Gift Card', points: 2500, icon: ShoppingBag, color: 'bg-purple-600' },
    { id: 'cash_50', name: '$50 Cash Bonus', points: 5000, icon: DollarSign, color: 'bg-green-600' },
    { id: 'day_off', name: 'Paid Day Off', points: 10000, icon: Star, color: 'bg-yellow-600' }
  ];

  const redeemRewardMutation = useMutation({
    mutationFn: async (reward) => {
      if (currentBalance < reward.points) {
        throw new Error("Insufficient points");
      }

      // Deduct points
      const newBalance = currentBalance - reward.points;
      
      await base44.entities.DriverPoints.create({
        driver_email: driverEmail,
        driver_name: driverName,
        points_earned: 0,
        points_spent: reward.points,
        current_balance: newBalance,
        source_type: 'reward_redemption',
        source_description: `Redeemed: ${reward.name}`,
        earned_at: new Date().toISOString()
      });

      // Send notification
      await base44.integrations.Core.SendEmail({
        to: driverEmail,
        subject: '🎁 Reward Redeemed Successfully!',
        body: `Congratulations ${driverName}!

You've successfully redeemed: ${reward.name}

Points Spent: ${reward.points}
Remaining Balance: ${newBalance} points

Your reward will be processed and delivered within 24-48 hours.

Keep up the great work!

- USPS Rewards Team`,
        from_name: 'USPS Driver Rewards'
      });

      return newBalance;
    },
    onSuccess: (newBalance) => {
      queryClient.invalidateQueries({ queryKey: ['driverPoints'] });
      toast.success(`Reward redeemed! ${newBalance} points remaining.`);
      setSelectedReward(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to redeem reward");
    }
  });

  const nextMilestone = rewards.find(r => r.points > currentBalance);

  return (
    <div className="space-y-4">
      {/* Points Balance Card */}
      <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50">
        <CardContent className="p-6">
          <div className="text-center">
            <Sparkles className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
            <p className="text-sm font-semibold text-gray-600 mb-1">Your Points Balance</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Star className="w-8 h-8 text-yellow-500" />
              <p className="text-5xl font-bold text-yellow-900">{currentBalance.toLocaleString()}</p>
            </div>
            <p className="text-xs text-gray-600">Total Earned: {totalEarned.toLocaleString()} points</p>

            {/* Progress to next reward */}
            {nextMilestone && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-yellow-300">
                <p className="text-xs font-semibold text-gray-900 mb-2">
                  Next Reward: {nextMilestone.name}
                </p>
                <Progress 
                  value={(currentBalance / nextMilestone.points) * 100} 
                  className="h-2 mb-1"
                />
                <p className="text-xs text-gray-600">
                  {nextMilestone.points - currentBalance} points to go
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card className="border-2 border-purple-300">
        <CardHeader className="bg-purple-50 border-b border-purple-200">
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Redeem Rewards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {rewards.map((reward) => {
            const Icon = reward.icon;
            const canAfford = currentBalance >= reward.points;

            return (
              <Card 
                key={reward.id}
                className={`border-2 ${
                  canAfford ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${reward.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{reward.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-purple-600 text-white">
                          {reward.points.toLocaleString()} points
                        </Badge>
                        {canAfford && (
                          <Badge className="bg-green-600 text-white">
                            Available
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        if (canAfford) {
                          if (confirm(`Redeem ${reward.name} for ${reward.points} points?`)) {
                            redeemRewardMutation.mutate(reward);
                          }
                        }
                      }}
                      disabled={!canAfford || redeemRewardMutation.isPending}
                      size="sm"
                      className={canAfford ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {canAfford ? 'Redeem' : 'Locked'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent Points Activity */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-blue-900">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentPoints.length > 0 ? (
            recentPoints.map((point) => (
              <div 
                key={point.id}
                className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {point.source_description}
                  </p>
                  <p className="text-xs text-gray-600">
                    {format(new Date(point.earned_at), "MMM d 'at' h:mm a")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    point.points_spent > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {point.points_spent > 0 ? '-' : '+'}{point.points_earned || point.points_spent}
                  </p>
                  {point.multiplier_applied > 1 && (
                    <Badge className="bg-orange-600 text-white text-xs">
                      {point.multiplier_applied}x
                    </Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No points activity yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Earn Points */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-green-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            How to Earn Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-green-800 space-y-1 ml-4 list-disc">
            <li><strong>+10 points</strong> per delivery completed</li>
            <li><strong>+25 points</strong> for premium package delivery</li>
            <li><strong>+50 points</strong> per training module completed</li>
            <li><strong>+100 points</strong> for week with zero exceptions</li>
            <li><strong>+200 points</strong> for earning a badge</li>
            <li><strong>+500 points</strong> for top 3 weekly ranking</li>
            <li><strong>2x multiplier</strong> for high customer ratings (4.5+)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}