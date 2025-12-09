import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, Bell, Shield, Key, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  takealot_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [takealotApiKey, setTakealotApiKey] = useState('');

  const { data: profile, isLoading } = useQuery<Profile>({ // Specify type here
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile; // Cast data here
    },
    enabled: !!user?.id,
  });

  const { data: lastSync } = useQuery<string>({ // Specify type here
    queryKey: ['last-sync', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('last_synced_at')
        .eq('user_id', user?.id)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.last_synced_at as string; // Cast data here
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCompanyName(profile.company_name || '');
      setTakealotApiKey(profile.takealot_api_key || '');
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          company_name: companyName,
          takealot_api_key: takealotApiKey,
        })
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Settings saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account and preferences">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="w-4 h-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company"
                />
              </div>
              <Button 
                onClick={() => updateProfile.mutate()} 
                className="bg-accent hover:bg-accent/90"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">API Integration</CardTitle>
              <CardDescription>Connect your Takealot seller account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-border p-4 bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Connection Status</span>
                  {takealotApiKey ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                {lastSync && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Sync</span>
                    <span className="font-mono">{new Date(lastSync).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="takealotKey">Takealot API Key</Label>
                <Input
                  id="takealotKey"
                  type="password"
                  value={takealotApiKey}
                  onChange={(e) => setTakealotApiKey(e.target.value)}
                  placeholder="Enter your Takealot API key"
                />
                <p className="text-xs text-muted-foreground">
                  Find your API key in your Takealot Seller Portal under Settings → API
                </p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Webhook URL</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Configure this URL in your Takealot Seller Portal to receive real-time updates:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value="https://kwrqqqiusycljrwhtbzh.supabase.co/functions/v1/takealot-webhook"
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText('https://kwrqqqiusycljrwhtbzh.supabase.co/functions/v1/takealot-webhook');
                        toast.success('Webhook URL copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">Setup Instructions</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Log in to your <a href="https://seller.takealot.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Takealot Seller Portal</a></li>
                    <li>Navigate to Settings → API Access</li>
                    <li>Generate a new API key and paste it in the field above</li>
                    <li>
                      <strong className="text-foreground">Important:</strong> Copy your API key exactly as shown (it usually starts with a long alphanumeric string)
                    </li>
                    <li>Add the webhook URL above to receive real-time updates (optional)</li>
                    <li>Click \"Save API Key\" below, then go to the Products page</li>
                    <li>Click \"Sync from Takealot\" to import your products</li>
                  </ol>
                </div>
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <h4 className="font-semibold mb-2 text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Troubleshooting
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>If you get a 401 error, double-check your API key is correct</li>
                    <li>Make sure you copied the entire API key without extra spaces</li>
                    <li>The API key should be saved in your Takealot Seller Portal first</li>
                    <li>Contact Takealot support if you can't find the API section</li>
                  </ul>
                </div>
              </div>
              <Button 
                onClick={() => updateProfile.mutate()} 
                className="bg-accent hover:bg-accent/90"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save API Key
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Notification Preferences</CardTitle>
              <CardDescription>Choose what updates you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[
                  { id: 'price_changes', label: 'Price Changes', description: 'Get notified when prices are automatically adjusted' },
                  { id: 'buy_box', label: 'Buy Box Updates', description: 'Alerts when you win or lose the buy box' },
                  { id: 'competitor', label: 'Competitor Alerts', description: 'New competitor or price changes from competitors' },
                  { id: 'stock_low', label: 'Low Stock Warnings', description: 'Alert when product stock is running low' },
                  { id: 'weekly_report', label: 'Weekly Reports', description: 'Weekly summary of your store performance' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline">Enable</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Change Password</p>
                    <p className="text-sm text-muted-foreground">Update your password regularly for security</p>
                  </div>
                  <Button variant="outline">Change</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-destructive">Delete Account</p>
                    <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                  </div>
                  <Button variant="destructive">Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
