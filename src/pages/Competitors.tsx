import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Mock competitor data for demonstration
const mockCompetitors = [
  { id: 1, product: 'Wireless Bluetooth Earbuds', sku: 'SKU-1001', your_price: 299.99, competitor_name: 'TechZone SA', competitor_price: 289.99, has_buy_box: true, price_diff: -10.00 },
  { id: 2, product: 'USB-C Charging Cable 2m', sku: 'SKU-1002', your_price: 79.99, competitor_name: 'GadgetWorld', competitor_price: 84.99, has_buy_box: false, price_diff: 5.00 },
  { id: 3, product: 'Phone Case - iPhone 15', sku: 'SKU-1003', your_price: 149.99, competitor_name: 'MobileAccessories', competitor_price: 149.99, has_buy_box: false, price_diff: 0 },
  { id: 4, product: 'Screen Protector Pack', sku: 'SKU-1004', your_price: 59.99, competitor_name: 'ScreenGuard Pro', competitor_price: 54.99, has_buy_box: true, price_diff: -5.00 },
  { id: 5, product: 'Laptop Stand Adjustable', sku: 'SKU-1005', your_price: 449.99, competitor_name: 'OfficeMate', competitor_price: 469.99, has_buy_box: false, price_diff: 20.00 },
];

export default function Competitors() {
  const { user } = useAuth();

  const { data: products } = useQuery({
    queryKey: ['products-with-competitors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const stats = [
    { label: 'Total Competitors Tracked', value: '127', icon: Users },
    { label: 'Products with Competition', value: products?.length || 0, icon: Trophy },
    { label: 'Average Price Gap', value: '-R 8.50', icon: TrendingDown },
  ];

  const getPriceDiffDisplay = (diff: number) => {
    if (diff > 0) {
      return (
        <span className="flex items-center gap-1 text-success font-medium">
          <TrendingUp className="w-4 h-4" />
          +R {diff.toFixed(2)}
        </span>
      );
    } else if (diff < 0) {
      return (
        <span className="flex items-center gap-1 text-destructive font-medium">
          <TrendingDown className="w-4 h-4" />
          -R {Math.abs(diff).toFixed(2)}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="w-4 h-4" />
        R 0.00
      </span>
    );
  };

  return (
    <DashboardLayout title="Competitors" subtitle="Track and monitor competitor pricing">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Competitor Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Competitor Price Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead>Competitor</TableHead>
                <TableHead>Their Price</TableHead>
                <TableHead>Price Gap</TableHead>
                <TableHead>Buy Box</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCompetitors.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium max-w-xs truncate">{item.product}</TableCell>
                  <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                  <TableCell className="font-semibold">R {item.your_price.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{item.competitor_name}</TableCell>
                  <TableCell>R {item.competitor_price.toFixed(2)}</TableCell>
                  <TableCell>{getPriceDiffDisplay(item.price_diff)}</TableCell>
                  <TableCell>
                    {item.has_buy_box ? (
                      <Badge className="buy-box-lost">They have it</Badge>
                    ) : (
                      <Badge className="buy-box-won">You have it</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
