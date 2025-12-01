import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, RefreshCw, Zap, TrendingDown, Target, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ruleTypes = [
  { value: 'beat_lowest', label: 'Beat Lowest Price', icon: TrendingDown, description: 'Always undercut the lowest competitor' },
  { value: 'match_buy_box', label: 'Match Buy Box', icon: Target, description: 'Match the current buy box price' },
  { value: 'beat_buy_box', label: 'Beat Buy Box', icon: Zap, description: 'Undercut the buy box holder' },
];

export default function Repricing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rule_type: 'beat_lowest',
    price_adjustment: '0.01',
    adjustment_type: 'fixed',
    min_margin: '',
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['repricing-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repricing_rules')
        .select('*')
        .eq('user_id', user?.id)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const addRule = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('repricing_rules').insert({
        user_id: user?.id,
        name: data.name,
        rule_type: data.rule_type,
        price_adjustment: parseFloat(data.price_adjustment),
        adjustment_type: data.adjustment_type,
        min_margin: data.min_margin ? parseFloat(data.min_margin) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repricing-rules'] });
      toast.success('Rule created successfully');
      setIsOpen(false);
      setFormData({ name: '', rule_type: 'beat_lowest', price_adjustment: '0.01', adjustment_type: 'fixed', min_margin: '' });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('repricing_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repricing-rules'] });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('repricing_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repricing-rules'] });
      toast.success('Rule deleted');
    },
  });

  const getRuleIcon = (type: string) => {
    const rule = ruleTypes.find(r => r.value === type);
    return rule?.icon || RefreshCw;
  };

  return (
    <DashboardLayout title="Repricing Rules" subtitle="Set up automated pricing strategies">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {ruleTypes.map((type) => (
          <Card key={type.value} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <type.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{type.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Active Rules</CardTitle>
            <CardDescription>Configure how your prices are automatically adjusted</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Create Repricing Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); addRule.mutate(formData); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Beat competitors by R1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule_type">Rule Type</Label>
                  <Select
                    value={formData.rule_type}
                    onValueChange={(value) => setFormData({ ...formData, rule_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ruleTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustment">Price Adjustment</Label>
                    <Input
                      id="adjustment"
                      type="number"
                      step="0.01"
                      value={formData.price_adjustment}
                      onChange={(e) => setFormData({ ...formData, price_adjustment: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjustment_type">Adjustment Type</Label>
                    <Select
                      value={formData.adjustment_type}
                      onValueChange={(value) => setFormData({ ...formData, adjustment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed (R)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_margin">Minimum Margin (%)</Label>
                  <Input
                    id="min_margin"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 15"
                    value={formData.min_margin}
                    onChange={(e) => setFormData({ ...formData, min_margin: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Never go below this profit margin</p>
                </div>
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={addRule.isPending}>
                  Create Rule
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rules?.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No repricing rules</h3>
              <p className="text-muted-foreground mb-4">Create your first rule to start automated repricing</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rules?.map((rule, index) => {
                const Icon = getRuleIcon(rule.rule_type);
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{rule.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {ruleTypes.find(t => t.value === rule.rule_type)?.label} • 
                          {rule.adjustment_type === 'fixed' ? ` R${rule.price_adjustment}` : ` ${rule.price_adjustment}%`}
                          {rule.min_margin && ` • Min margin: ${rule.min_margin}%`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule.mutate(rule.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
