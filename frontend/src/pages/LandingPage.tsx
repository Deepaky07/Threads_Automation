import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Bell, MessageCircle, Workflow, CheckCircle2, Zap, Shield, Clock, Bot, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      console.log('✅ User already authenticated, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Bot className="h-12 w-12 animate-spin text-purple-600" />
      </div>
    );
  }

  const features = [
    {
      icon: Search,
      title: "Smart Search Bot",
      description: "Automatically search and engage with relevant Threads posts based on keywords",
      color: "bg-blue-500/10 text-blue-500"
    },
    {
      icon: Bell,
      title: "Notification Monitor",
      description: "Stay on top of all notifications with automated checks and replies",
      color: "bg-purple-500/10 text-purple-500"
    },
    {
      icon: MessageCircle,
      title: "Like, Comment & Reply",
      description: "Engage naturally with posts through smart likes, comments, and replies",
      color: "bg-green-500/10 text-green-500"
    },
    {
      icon: Workflow,
      title: "Full Automation",
      description: "Schedule and automate your entire Threads posting workflow",
      color: "bg-orange-500/10 text-orange-500"
    },
  ];

  const benefits = [
    { icon: Zap, title: "Lightning Fast", description: "Automate hours of work in minutes" },
    { icon: Shield, title: "Secure & Safe", description: "Your credentials are encrypted and secure" },
    { icon: Clock, title: "24/7 Automation", description: "Let bots work while you sleep" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-purple-600" />
            <span className="text-2xl font-bold">Threads Automation</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button onClick={() => navigate('/register')} className="bg-purple-600 hover:bg-purple-700">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100">
          <Zap className="h-3 w-3 mr-1" />
          Automate Your Threads Presence
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Grow Your Threads Account
          <br />
          on Autopilot
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Automate searching, engaging, posting, and monitoring on Threads. 
          Save hours of manual work with intelligent automation.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate('/register')} className="bg-purple-600 hover:bg-purple-700">
            Start Free Trial
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-16">
          <div>
            <div className="text-4xl font-bold text-purple-600">10K+</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-600">1M+</div>
            <div className="text-sm text-muted-foreground">Posts Automated</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-600">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Automation Features</h2>
          <p className="text-muted-foreground text-lg">Everything you need to automate your Threads presence</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-purple-200 transition-colors">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-3`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 text-purple-600 mb-4">
                <benefit.icon className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Automate Your Threads?
            </h2>
            <p className="text-lg mb-8 text-purple-100">
              Join thousands of users who are growing their Threads presence on autopilot
            </p>
            <Button size="lg" variant="secondary" onClick={() => navigate('/register')}>
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Threads Automation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}