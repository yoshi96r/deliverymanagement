import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Award, Lock, Star, Zap, Trophy, Target,
  CheckCircle2, TrendingUp
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function BadgeShowcase({ driverEmail }) {
  const { data: earnedBadges, isLoading: badgesLoading } = useQuery({
    queryKey: ['driverBadges', driverEmail],
    queryFn: async () => {
      const badges = await base44.entities.DriverBadge.filter({
        driver_email: driverEmail
      });
      return badges.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
    },
    initialData: [],
  });

  const { data: availableMilestones, isLoading: milestonesLoading } = useQuery({
    queryKey: ['achievementMilestones'],
    queryFn: async () => {
      const milestones = await base44.entities.AchievementMilestone.filter({
        is_active: true
      });
      return milestones;
    },
    initialData: [],
  });

  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));
  const unearnedMilestones = availableMilestones.filter(m => !earnedBadgeIds.has(m.milestone_id));

  const getTierColor = (tier) => {
    switch (tier) {
      case 'diamond': return 'bg-gradient-to-r from-cyan-400 to-blue-500';
      case 'platinum': return 'bg-gradient-to-r from-gray-200 to-gray-400';
      case 'gold': return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 'silver': return 'bg-gradient-to-r from-gray-300 to-gray-500';
      case 'bronze': return 'bg-gradient-to-r from-orange-400 to-orange-600';
      default: return 'bg-blue-600';
    }
  };

  const getTierBorderColor = (tier) => {
    switch (tier) {
      case 'diamond': return 'border-cyan-400';
      case 'platinum': return 'border-gray-400';
      case 'gold': return 'border-yellow-400';
      case 'silver': return 'border-gray-400';
      case 'bronze': return 'border-orange-400';
      default: return 'border-blue-400';
    }
  };

  if (badgesLoading || milestonesLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading achievements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <Trophy className="w-8 h-8 mx-auto text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-purple-900">{earnedBadges.length}</p>
              <p className="text-xs text-gray-600">Badges Earned</p>
            </div>
            <div>
              <Target className="w-8 h-8 mx-auto text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-purple-900">{unearnedMilestones.length}</p>
              <p className="text-xs text-gray-600">To Unlock</p>
            </div>
            <div>
              <Star className="w-8 h-8 mx-auto text-orange-600 mb-1" />
              <p className="text-2xl font-bold text-purple-900">
                {earnedBadges.filter(b => b.is_rare).length}
              </p>
              <p className="text-xs text-gray-600">Rare Badges</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earned Badges */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-600" />
          Your Badges ({earnedBadges.length})
        </h3>

        {earnedBadges.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {earnedBadges.map((badge) => (
              <Card 
                key={badge.id}
                className={`border-2 ${getTierBorderColor(badge.badge_tier)} relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-16 h-16 ${getTierColor(badge.badge_tier)} opacity-20 rounded-bl-full`}></div>
                
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${getTierColor(badge.badge_tier)} rounded-full flex items-center justify-center text-2xl flex-shrink-0`}>
                      {badge.icon_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <p className="font-bold text-gray-900 text-sm truncate">{badge.badge_name}</p>
                        {badge.is_rare && (
                          <Zap className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{badge.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge className={`${getTierColor(badge.badge_tier)} text-white text-xs`}>
                          {badge.badge_tier}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {format(new Date(badge.earned_at), "MMM d")}
                        </span>
                      </div>
                      {badge.points_awarded > 0 && (
                        <p className="text-xs text-purple-700 font-semibold mt-1">
                          +{badge.points_awarded} points
                        </p>
                      )}
                      {badge.is_rare && (
                        <p className="text-xs text-orange-700 font-semibold mt-1">
                          ⭐ Only {badge.rarity_percentage?.toFixed(1)}% have this!
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="p-8 text-center">
              <Award className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No badges earned yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Complete deliveries and training to earn your first badge!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Achievements */}
      {unearnedMilestones.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" />
            Unlock These Achievements
          </h3>

          <div className="space-y-2">
            {unearnedMilestones.slice(0, 5).map((milestone) => (
              <Card 
                key={milestone.id}
                className="border-2 border-gray-300 bg-gray-50 opacity-75"
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      {milestone.icon_emoji}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-700 text-sm">{milestone.milestone_name}</p>
                        <Badge className="bg-gray-500 text-white text-xs">
                          {milestone.difficulty}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{milestone.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 text-white text-xs">
                          +{milestone.points_reward} points
                        </Badge>
                        <Badge className={`${getTierColor(milestone.badge_tier)} text-white text-xs`}>
                          {milestone.badge_tier} badge
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Gamification Info */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="p-4">
          <p className="text-xs text-green-900 mb-2">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            <strong>Earn badges and points by:</strong>
          </p>
          <ul className="text-xs text-green-800 space-y-1 ml-4 list-disc">
            <li>Completing deliveries on time</li>
            <li>Maintaining perfect safety records</li>
            <li>Finishing training modules</li>
            <li>Receiving excellent customer feedback</li>
            <li>Achieving efficiency milestones</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}