import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, TrendingUp, TrendingDown, Star, Navigation, 
  Shield, Target, Award, Crown, Medal
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function LeaderboardDisplay({ driverEmail }) {
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
  const [selectedMetric, setSelectedMetric] = useState("overall_performance");

  const { data: leaderboards, isLoading } = useQuery({
    queryKey: ['leaderboards', selectedPeriod, selectedMetric],
    queryFn: async () => {
      const boards = await base44.entities.PerformanceLeaderboard.filter({
        period_type: selectedPeriod,
        metric_type: selectedMetric
      });
      return boards.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
    },
    initialData: [],
  });

  const currentLeaderboard = leaderboards[0];
  const myRanking = currentLeaderboard?.rankings?.find(r => r.driver_email === driverEmail);

  const metricOptions = [
    { value: 'overall_performance', label: 'Overall Score', icon: Trophy },
    { value: 'customer_satisfaction', label: 'Customer Love', icon: Star },
    { value: 'route_efficiency', label: 'Efficiency', icon: Navigation },
    { value: 'safety_score', label: 'Safety', icon: Shield },
    { value: 'total_points', label: 'Total Points', icon: Award }
  ];

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-600" />;
    return <div className="w-6 h-6 flex items-center justify-center font-bold text-gray-600">#{rank}</div>;
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return "bg-yellow-500 text-white";
    if (rank === 2) return "bg-gray-400 text-white";
    if (rank === 3) return "bg-orange-600 text-white";
    if (rank <= 10) return "bg-blue-600 text-white";
    return "bg-gray-600 text-white";
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading leaderboards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My Ranking Card */}
      {myRanking && (
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                {getRankIcon(myRanking.rank)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-700">Your Ranking</p>
                <p className="text-3xl font-bold text-purple-900">
                  #{myRanking.rank}
                  <span className="text-lg text-gray-600"> of {currentLeaderboard.total_drivers}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {myRanking.rank_change !== undefined && myRanking.rank_change !== 0 && (
                    <Badge className={
                      myRanking.rank_change > 0 ? 'bg-green-600' : 'bg-red-600'
                    }>
                      {myRanking.rank_change > 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3 mr-1" />
                          +{myRanking.rank_change}
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3 mr-1" />
                          {myRanking.rank_change}
                        </>
                      )}
                    </Badge>
                  )}
                  <Badge className="bg-blue-600">
                    {myRanking.score} points
                  </Badge>
                  {myRanking.badge_count > 0 && (
                    <Badge className="bg-yellow-600">
                      🏆 {myRanking.badge_count} badges
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Selection */}
      <div className="flex gap-2">
        {[
          { value: 'daily', label: 'Today' },
          { value: 'weekly', label: 'This Week' },
          { value: 'monthly', label: 'This Month' },
          { value: 'all_time', label: 'All Time' }
        ].map((period) => (
          <Button
            key={period.value}
            onClick={() => setSelectedPeriod(period.value)}
            variant={selectedPeriod === period.value ? "default" : "outline"}
            size="sm"
            className={selectedPeriod === period.value ? "bg-purple-600" : ""}
          >
            {period.label}
          </Button>
        ))}
      </div>

      {/* Metric Tabs */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
        <TabsList className="grid w-full grid-cols-5 bg-white">
          {metricOptions.map((metric) => {
            const Icon = metric.icon;
            return (
              <TabsTrigger key={metric.value} value={metric.value} className="text-xs">
                <Icon className="w-4 h-4 mr-1" />
                {metric.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {metricOptions.map((metric) => (
          <TabsContent key={metric.value} value={metric.value} className="mt-4">
            {currentLeaderboard && currentLeaderboard.rankings.length > 0 ? (
              <div className="space-y-2">
                {currentLeaderboard.rankings.map((ranking, index) => {
                  const isCurrentDriver = ranking.driver_email === driverEmail;
                  
                  return (
                    <Card 
                      key={ranking.driver_email}
                      className={`border-2 transition-all ${
                        isCurrentDriver 
                          ? 'border-purple-400 bg-purple-50 shadow-lg' 
                          : index < 3 
                            ? 'border-yellow-300 bg-yellow-50' 
                            : 'border-gray-200 bg-white'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          {/* Rank Icon */}
                          <div className="flex-shrink-0">
                            {getRankIcon(ranking.rank)}
                          </div>

                          {/* Driver Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900 truncate">
                                {ranking.driver_name}
                                {isCurrentDriver && (
                                  <span className="text-purple-600 ml-2">(You)</span>
                                )}
                              </p>
                              {ranking.rank <= 3 && (
                                <Badge className={getRankBadgeColor(ranking.rank)}>
                                  Top {ranking.rank}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-bold text-blue-900">
                                {ranking.metric_value?.toFixed(1) || ranking.score}
                              </span>
                              
                              {ranking.total_points > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {ranking.total_points} pts
                                </Badge>
                              )}
                              
                              {ranking.badge_count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  🏆 {ranking.badge_count}
                                </Badge>
                              )}
                              
                              {ranking.rank_change !== undefined && ranking.rank_change !== 0 && (
                                <div className={`flex items-center text-xs ${
                                  ranking.rank_change > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {ranking.rank_change > 0 ? (
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3 mr-1" />
                                  )}
                                  {Math.abs(ranking.rank_change)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-2 border-dashed border-gray-200">
                <CardContent className="p-12 text-center">
                  <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No leaderboard data available</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Complete deliveries to appear on the leaderboard!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Leaderboard Info */}
      {currentLeaderboard && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-xs text-blue-900">
              📊 Last updated: {format(new Date(currentLeaderboard.generated_at), "MMM d 'at' h:mm a")}
            </p>
            <p className="text-xs text-blue-800 mt-1">
              💡 Rankings update every hour based on real-time performance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}