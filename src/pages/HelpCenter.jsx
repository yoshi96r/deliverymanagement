import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, Search, Book, Video, MessageSquare,
  FileText, Zap, Package, Users, Settings
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");

  const helpTopics = [
    {
      category: "Getting Started",
      icon: Zap,
      color: "blue",
      articles: [
        { title: "Creating your first shipping label", content: "Step-by-step guide to create a shipping label in under 2 minutes..." },
        { title: "Setting up driver accounts", content: "How to invite and configure drivers in your system..." },
        { title: "Configuring routes and zones", content: "Best practices for route configuration..." },
      ]
    },
    {
      category: "Driver Mobile App",
      icon: Package,
      color: "green",
      articles: [
        { title: "Scanning packages on mobile", content: "Use the camera to scan barcodes and track deliveries..." },
        { title: "Capturing delivery proof", content: "Take photos and get signatures for proof of delivery..." },
        { title: "Reporting exceptions", content: "How to report and handle delivery exceptions..." },
      ]
    },
    {
      category: "Fleet Management",
      icon: Users,
      color: "purple",
      articles: [
        { title: "Tracking driver locations", content: "Real-time GPS tracking and route monitoring..." },
        { title: "Route optimization", content: "Using AI to optimize delivery routes..." },
        { title: "Performance analytics", content: "Understanding driver performance metrics..." },
      ]
    },
    {
      category: "Payments & Billing",
      icon: FileText,
      color: "orange",
      articles: [
        { title: "Processing driver payments", content: "Creating payment batches and managing earnings..." },
        { title: "Understanding shipping costs", content: "How shipping rates are calculated..." },
        { title: "Refunds and credits", content: "Handling refunds for voided labels..." },
      ]
    },
    {
      category: "System Administration",
      icon: Settings,
      color: "red",
      articles: [
        { title: "Managing system settings", content: "Configure global system preferences..." },
        { title: "User roles and permissions", content: "Setting up access control..." },
        { title: "Data backup and export", content: "Exporting and backing up your data..." },
      ]
    },
  ];

  const filteredTopics = helpTopics.map(topic => ({
    ...topic,
    articles: topic.articles.filter(article =>
      !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(topic => topic.articles.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            <HelpCircle className="w-12 h-12 text-blue-600" />
            Help Center
          </h1>
          <p className="text-lg text-gray-600">Find answers and learn how to use the platform</p>
        </div>

        {/* Search */}
        <Card className="border-2 border-blue-200 mb-8">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search help articles..."
                className="pl-14 h-14 text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-2 border-green-200 bg-green-50 cursor-pointer hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <Video className="w-12 h-12 mx-auto mb-3 text-green-600" />
              <h3 className="font-bold text-gray-900 mb-2">Video Tutorials</h3>
              <p className="text-sm text-gray-600">Watch step-by-step guides</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-purple-50 cursor-pointer hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-purple-600" />
              <h3 className="font-bold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-sm text-gray-600">Get help from our team</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-orange-50 cursor-pointer hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <Book className="w-12 h-12 mx-auto mb-3 text-orange-600" />
              <h3 className="font-bold text-gray-900 mb-2">Documentation</h3>
              <p className="text-sm text-gray-600">Browse full docs</p>
            </CardContent>
          </Card>
        </div>

        {/* Help Topics */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>Browse by Topic</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredTopics.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">No articles found</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-4">
                {filteredTopics.map((topic, idx) => {
                  const Icon = topic.icon;
                  return (
                    <AccordionItem key={idx} value={`topic-${idx}`} className="border-2 border-gray-200 rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full bg-${topic.color}-100 flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 text-${topic.color}-600`} />
                          </div>
                          <div className="text-left">
                            <h3 className="font-bold text-gray-900">{topic.category}</h3>
                            <p className="text-sm text-gray-600">{topic.articles.length} articles</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 mt-4">
                          {topic.articles.map((article, articleIdx) => (
                            <div key={articleIdx} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
                              <h4 className="font-semibold text-gray-900 mb-2">{article.title}</h4>
                              <p className="text-sm text-gray-600">{article.content}</p>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="border-2 border-blue-200 mt-8">
          <CardContent className="p-8 text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-blue-600 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Still need help?</h3>
            <p className="text-gray-600 mb-6">Our support team is here to assist you</p>
            <div className="flex gap-4 justify-center">
              <Button className="bg-blue-600">
                <MessageSquare className="w-5 h-5 mr-2" />
                Chat with Support
              </Button>
              <Button variant="outline" className="border-2 border-blue-300">
                Email Us
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}