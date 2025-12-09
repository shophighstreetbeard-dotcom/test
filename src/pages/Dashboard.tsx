import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  ShoppingCart,
  Trophy,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

interface PriceHistoryItem {
  id: string;
  created_at: string;
  reason: string;
  old_price: number;
  new_price: number;
  products: {
    sku: string;
    title: string;
  } | null;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: products } = useQuery({
    queryKey: ['products-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: buyBoxStats } = useQuery({
    queryKey: ['buybox-stats', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('buy_box_status')
        .eq('user_id', user!.id);
      
      const won = data?.filter(p => p.buy_box_status === 'won').length || 0;
      const lost = data?.filter(p => p.buy_box_status === 'lost').length || 0;
      const unknown = data?.filter(p => !p.buy_box_status || p.buy_box_status === 'unknown').length || 0;
      const total = won + lost + unknown;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      
      return { won, lost, unknown, winRate };
    },
    enabled: !!user,
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales-summary', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('sale_price, profit, quantity')
        .eq('user_id', user!.id);
      
      const totalRevenue = data?.reduce((sum, s) => sum + Number(s.sale_price) * s.quantity, 0) || 0;
      const totalProfit = data?.reduce((sum, s) => sum + (Number(s.profit) || 0), 0) || 0;
      const totalOrders = data?.length || 0;
      
      return { totalRevenue, totalProfit, totalOrders };
    },
    enabled: !!user,
  });

  const { data: priceHistory } = useQuery<PriceHistoryItem[]>({ // Define the type here
    queryKey: ['price-history-recent', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('price_history')
        .select(`
          id,
          created_at,
          reason,
          old_price,
          new_price,
          products (sku, title)
        `)
        .order('created_at', { ascending: false })
        .limit(5)
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: salesChartData } = useQuery<{
    name: string;
    sales: number;
    profit: number;
}[]>({ // Define the type here
    queryKey: ['sales-chart-data', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, sale_price, profit')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const dateMap = new Map<string, { sales: number; profit: number }>();

      data.forEach(sale => {
        const date = new Date(sale.created_at).toLocaleDateString();
        const existing = dateMap.get(date) || { sales: 0, profit: 0 };
        existing.sales += sale.sale_price;
        existing.profit += sale.profit || 0;
        dateMap.set(date, existing);
      });

      return Array.from(dateMap.entries()).map(([name, values]) => ({ name, ...values }));
    },
    enabled: !!user,
  });

  const buyBoxData = [
    { name: 'Won', value: buyBoxStats?.won || 0, color: 'hsl(var(--success))' },
    { name: 'Lost', value: buyBoxStats?.lost || 0, color: 'hsl(var(--destructive))' },
    { name: 'Unknown', value: buyBoxStats?.unknown || 0, color: 'hsl(var(--muted))' },
  ];

  const stats = [
    {
      title: 'Total Revenue',
      value: `R ${(salesData?.totalRevenue || 0).toLocaleString()}`,
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
    },
    {
      title: 'Total Orders',
      value: salesData?.totalOrders || 0,
      change: '+8.2%',
      trend: 'up',
      icon: ShoppingCart,
    },
    {
      title: 'Active Products',
      value: products || 0,
      change: '+3',
      trend: 'up',
      icon: Package,
    },
    {
      title: 'Buy Box Win Rate',
      value: `${buyBoxStats?.winRate || 0}%`,
      change: buyBoxStats?.winRate && buyBoxStats.winRate > 50 ? '+' : '-',
      trend: buyBoxStats?.winRate && buyBoxStats.winRate > 50 ? 'up' : 'down',
      icon: Trophy,
    },
  ];

  return (
    <DashboardLayout title="Dashboard" subtitle="Your Takealot repricing overview">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  stat.trend === 'up' ? 'text-success' : 'text-destructive'
                }`}>
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{String(stat.value)}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--accent))" 
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Buy Box Status */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Buy Box Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buyBoxData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={60} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Price Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {priceHistory && priceHistory.length > 0 ? (
              priceHistory.map((item: PriceHistoryItem) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.products?.sku || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{item.reason || 'Price adjusted'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground line-through">R {Number(item.old_price).toFixed(2)}</span>
                      {Number(item.new_price) < Number(item.old_price) ? (
                        <TrendingDown className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-destructive" />
                      )}
                      <span className={`font-semibold ${Number(item.new_price) < Number(item.old_price) ? 'text-success' : 'text-destructive'}`}>
                        R {Number(item.new_price).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No price changes yet. Sync products and run the AI repricer to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
