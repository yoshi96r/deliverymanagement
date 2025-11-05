import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, TruckIcon, MapPin, Shield, Camera, CheckCircle2,
  Users, BarChart3, Zap, ArrowRight, Star, Clock, Building2,
  Bell, FileText, Clipboard, DollarSign, Settings, Target
} from "lucide-react";
import { createPageUrl } from "@/utils";

export default function DemoHome() {
  const handleLogin = () => {
    base44.auth.redirectToLogin();
  };

  const postmasterFeatures = [
    {
      icon: Users,
      title: "Carrier Management - Simplified",
      description: "Track all carriers, subs, performance, certifications, and pay in one dashboard. No more spreadsheets.",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: BarChart3,
      title: "Automated Reporting",
      description: "Daily, weekly, monthly reports auto-generated. Send to district with one click. USPS compliance built-in.",
      color: "bg-green-100 text-green-600"
    },
    {
      icon: DollarSign,
      title: "Payment Processing",
      description: "Automatic carrier earnings calculation. Track photo verification pay, route completion bonuses, expenses.",
      color: "bg-yellow-100 text-yellow-600"
    },
    {
      icon: MapPin,
      title: "Route Documentation",
      description: "Let carriers record routes with GPS. Subs follow recordings. Cut training time by 50%. Routes never lost again.",
      color: "bg-purple-100 text-purple-600"
    },
    {
      icon: Bell,
      title: "Exception Management",
      description: "Auto-notify customers of delays. Handle access issues, damage reports, signature requests all in one place.",
      color: "bg-orange-100 text-orange-600"
    },
    {
      icon: Shield,
      title: "Compliance Tracking",
      description: "DOT, HOS, certifications, inspections - all tracked automatically. Alerts before expirations. Audit-ready.",
      color: "bg-indigo-100 text-indigo-600"
    },
    {
      icon: Settings,
      title: "Automation Everything",
      description: "Auto-assign routes, auto-process payments, auto-generate reports, auto-alert on issues. Set it and forget it.",
      color: "bg-red-100 text-red-600"
    },
    {
      icon: Target,
      title: "Performance Analytics",
      description: "See who's excelling, who needs help. Track trends, identify training needs, measure improvements.",
      color: "bg-pink-100 text-pink-600"
    }
  ];

  const postmasterPainPoints = [
    {
      pain: "Drowning in paperwork and manual reporting",
      solution: "Automated daily operations summaries, auto-generated reports sent to your email"
    },
    {
      pain: "Managing substitute carriers who don't know routes",
      solution: "GPS route recording system - regulars record once, subs follow forever"
    },
    {
      pain: "Tracking carrier earnings, expenses, and performance",
      solution: "Automatic earnings calculation based on deliveries, transparent payment tracking"
    },
    {
      pain: "Customer complaints about missed deliveries",
      solution: "Photo proof system shows exactly what happened, when, and where"
    },
    {
      pain: "Keeping up with DOT compliance, certifications, inspections",
      solution: "Automatic tracking with expiration alerts 30 days before due"
    },
    {
      pain: "Coordinating between carriers, customers, and district",
      solution: "Built-in messaging, automated customer notifications, exception handling"
    }
  ];

  const automationExamples = [
    "🤖 Auto-assign routes to available carriers each morning",
    "📊 Auto-generate and email district reports every Friday",
    "💰 Auto-calculate carrier pay based on completed deliveries",
    "🔔 Auto-notify customers when carrier is 10 stops away",
    "⚠️ Auto-escalate exceptions that need postmaster attention",
    "📸 Auto-track photo proof earnings for premium packages",
    "📅 Auto-remind carriers of expiring certifications",
    "🎯 Auto-flag performance issues needing coaching"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Hero Section - Postmaster Focused */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
              <Building2 className="w-10 h-10 text-blue-600" />
            </div>
          </div>
          <Badge className="bg-white text-blue-600 mb-4 px-6 py-2 text-lg font-bold">
            For Post Masters & Office Managers
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Everything You Need to Run Your Post Office
          </h1>
          <p className="text-2xl md:text-3xl font-semibold mb-4 text-blue-100">
            All in One Place. Mostly Automated.
          </p>
          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
            Stop juggling 15 different systems. CarrierConnect consolidates carrier management, 
            route documentation, compliance tracking, payment processing, customer service, and reporting 
            into one automated platform. <strong>Built specifically for rural post offices.</strong>
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              onClick={handleLogin}
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 h-auto font-bold shadow-2xl"
            >
              <ArrowRight className="w-6 h-6 mr-2" />
              See How It Works (Free Demo)
            </Button>
            <Button
              onClick={() => window.location.href = createPageUrl("BusinessRegistration")}
              className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6 h-auto font-bold shadow-2xl border-2 border-white"
            >
              <Building2 className="w-6 h-6 mr-2" />
              Register Your Post Office
            </Button>
          </div>
          <p className="text-sm text-white/80 mt-4">
            ✓ <strong>FREE for carriers</strong> • ✓ Affordable for post offices • ✓ Implementation support included
          </p>
        </div>
      </div>

      {/* Postmaster Pain Points Solution */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">We Know What You're Dealing With</h2>
          <p className="text-xl text-gray-600">You have too much to manage. We automate most of it.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {postmasterPainPoints.map((item, index) => (
            <Card key={index} className="border-2 border-red-200 hover:border-green-300 hover:shadow-xl transition-all">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold text-sm">✗</span>
                  </div>
                  <p className="text-sm font-semibold text-red-700">{item.pain}</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800 font-medium">{item.solution}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Postmaster Features Grid */}
      <div className="bg-gray-50 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Complete Post Office Management</h2>
            <p className="text-xl text-gray-600">Everything you need, nothing you don't</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {postmasterFeatures.map((feature, index) => (
              <Card key={index} className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all">
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Automation Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-purple-100 rounded-full mb-4">
            <Zap className="w-12 h-12 text-purple-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Set It Once, It Runs Forever</h2>
          <p className="text-xl text-gray-600 mb-8">
            CarrierConnect automates the repetitive tasks that eat up your day
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {automationExamples.map((example, index) => (
            <div key={index} className="p-4 bg-white rounded-lg border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-gray-800 font-medium">{example}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border-2 border-purple-200">
          <div className="flex items-start gap-4">
            <Target className="w-12 h-12 text-purple-600 flex-shrink-0" />
            <div>
              <h3 className="text-2xl font-bold text-purple-900 mb-3">Your Time Back</h3>
              <p className="text-lg text-purple-800 mb-4">
                Post masters using CarrierConnect report saving <strong>10-15 hours per week</strong> on 
                administrative tasks. That's time you can spend on what matters: serving your community 
                and supporting your carriers.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">10-15hrs</p>
                  <p className="text-sm text-gray-600">Saved per week</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-3xl font-bold text-green-600">50%</p>
                  <p className="text-sm text-gray-600">Faster sub training</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">90%</p>
                  <p className="text-sm text-gray-600">Less paperwork</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section - Postmaster Focused */}
      <div className="bg-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Built for Small Rural Post Offices</h2>
            <p className="text-xl text-gray-600">Affordable pricing that makes sense for your budget</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="border-2 border-blue-300 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
                <CardTitle className="text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-3xl font-bold">For Your Post Office</p>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-blue-600 mb-2">$99/month</div>
                  <p className="text-gray-600">Unlimited carriers • All features included</p>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Complete carrier management system</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">GPS route recording & following</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Automated payment processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Auto-generated reports (daily/weekly/monthly)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">DOT & USPS compliance tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Customer communication automation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Analytics & performance dashboards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">24/7 support & implementation help</span>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200 mb-6">
                  <p className="text-sm font-bold text-green-900 mb-2">💰 Carriers Use It FREE</p>
                  <p className="text-sm text-green-800">
                    Your carriers get all features at no cost. They actually earn MORE with photo verification bonuses.
                  </p>
                </div>

                <Button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-bold h-14 text-lg"
                >
                  Start Free 30-Day Trial
                </Button>
                <p className="text-center text-sm text-gray-600 mt-3">
                  No credit card required • Cancel anytime • Full setup support
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto py-16 px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-600 mb-2">100%</div>
            <p className="text-gray-600">FREE for Carriers</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600 mb-2">50%</div>
            <p className="text-gray-600">Faster Sub Training</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-purple-600 mb-2">10-15hrs</div>
            <p className="text-gray-600">Saved Weekly</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-orange-600 mb-2">24/7</div>
            <p className="text-gray-600">Support Available</p>
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Star className="w-12 h-12 mx-auto mb-4" />
          <blockquote className="text-2xl md:text-3xl font-semibold italic mb-6">
            "I was drowning in paperwork and constantly training new subs on routes. CarrierConnect 
            automated my reporting and let my regulars record routes that subs can actually follow. 
            I got my weekends back."
          </blockquote>
          <p className="text-xl text-blue-100">
            — Sarah M., Postmaster, Rural Route 127
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          Ready to Simplify Your Post Office Management?
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Join post offices across America using CarrierConnect to automate operations
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            onClick={handleLogin}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700 text-xl px-12 py-8 h-auto font-bold shadow-2xl"
          >
            <ArrowRight className="w-6 h-6 mr-3" />
            Start Free 30-Day Trial
          </Button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          ✓ No credit card • ✓ Full setup support • ✓ Cancel anytime
        </p>
      </div>

      {/* Footer with Privacy */}
      <div className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3">CarrierConnect</h4>
              <p className="text-gray-400 text-sm">
                Complete post office management system. Built specifically for rural post offices 
                and their carriers. Everything in one place, mostly automated.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3">For Post Masters</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">How It Works</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Implementation Support</a></li>
                <li><a href="#" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-3">Legal & Privacy</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href={createPageUrl("PrivacyPolicy")} className="hover:text-white">Privacy Policy</a></li>
                <li><a href={createPageUrl("TermsOfService")} className="hover:text-white">Terms of Service</a></li>
                <li><a href={createPageUrl("DataSecurity")} className="hover:text-white">Data Security</a></li>
                <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 CarrierConnect. All rights reserved. | GDPR & CCPA Compliant
            </p>
            <p className="text-gray-500 text-xs mt-2">
              🔒 Your data is encrypted and secure. We never sell your information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}