import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  GraduationCap, Video, BookOpen, CheckCircle2, 
  Clock, Award, TrendingUp, Play
} from "lucide-react";
import { format } from "date-fns";

export default function TrainingPortal() {
  const [selectedModule, setSelectedModule] = useState(null);

  const queryClient = useQueryClient();

  const { data: modules } = useQuery({
    queryKey: ['trainingModules'],
    queryFn: () => base44.entities.DriverTrainingModule.list(),
    initialData: [],
  });

  const { data: progress } = useQuery({
    queryKey: ['myTrainingProgress'],
    queryFn: () => base44.entities.DriverTrainingProgress.list(),
    initialData: [],
  });

  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.module_category]) {
      acc[module.module_category] = [];
    }
    acc[module.module_category].push(module);
    return acc;
  }, {});

  const completedModules = progress.filter(p => p.status === 'completed').length;
  const totalModules = modules.length;
  const overallProgress = totalModules > 0 ? (completedModules / totalModules * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <GraduationCap className="w-10 h-10 text-blue-600" />
            Driver Training Portal
          </h1>
          <p className="text-gray-600">Complete training modules to improve your skills</p>
        </div>

        {/* Progress Overview */}
        <Card className="border-2 border-blue-200 mb-8">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-blue-900">Your Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Overall Completion</span>
                <span className="text-sm font-bold text-blue-900">{completedModules}/{totalModules} Modules</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-green-900">{completedModules}</p>
                <p className="text-xs text-gray-600">Completed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-900">
                  {progress.filter(p => p.status === 'in_progress').length}
                </p>
                <p className="text-xs text-gray-600">In Progress</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-900">
                  {modules.filter(m => m.is_mandatory).length}
                </p>
                <p className="text-xs text-gray-600">Required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Modules by Category */}
        {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
          <Card key={category} className="border-2 border-gray-200 mb-6">
            <CardHeader className="bg-gray-50">
              <CardTitle className="capitalize">{category.replace(/_/g, ' ')}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryModules.map((module) => {
                  const moduleProgress = progress.find(p => p.training_module_id === module.id);
                  const isCompleted = moduleProgress?.status === 'completed';
                  const inProgress = moduleProgress?.status === 'in_progress';

                  return (
                    <Card key={module.id} className={`border-2 ${
                      isCompleted ? 'border-green-300 bg-green-50' :
                      inProgress ? 'border-blue-300 bg-blue-50' :
                      'border-gray-200'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-green-600' :
                            inProgress ? 'bg-blue-600' :
                            'bg-gray-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-white" />
                            ) : module.content_type === 'video' ? (
                              <Video className="w-6 h-6 text-white" />
                            ) : (
                              <BookOpen className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 mb-1">{module.module_name}</h4>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {module.estimated_duration_minutes} min
                              </Badge>
                              {module.is_mandatory && (
                                <Badge className="bg-red-600 text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600">{module.description}</p>
                          </div>
                        </div>

                        {isCompleted ? (
                          <div className="p-2 bg-green-100 rounded border border-green-300">
                            <p className="text-xs font-semibold text-green-900">
                              ✓ Completed {format(new Date(moduleProgress.completed_at), "MMM d, yyyy")}
                            </p>
                            {moduleProgress.quiz_score && (
                              <p className="text-xs text-green-800 mt-1">
                                Score: {moduleProgress.quiz_score}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <Button size="sm" className="w-full bg-blue-600">
                            <Play className="w-4 h-4 mr-1" />
                            {inProgress ? "Continue" : "Start"} Training
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}