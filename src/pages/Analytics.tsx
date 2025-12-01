import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { TrendingUp, DollarSign, Package, ShoppingCart } from 'lucide-react';

const salesData = [
  { date: 'Jan', revenue: 12400, orders: 145, profit: 3200 },
  { date: 'Feb', revenue: 15600, orders: 178, profit: 4100 },
  { date: 'Mar', revenue: 14200, orders: 156, profit: 3600 },
  { date: 'Apr', revenue: 18900, orders: 210, profit: 5200 },
  { date: 'May', revenue: 22100, orders: 245, profit: 6100 },
  { date: 'Jun', revenue: 19800, orders: 223, profit: 5400 },
  { date: 'Jul', revenue: 24500, orders: 267, profit: 6800 },
];

const categoryData = [
  { name: 'Electronics', value: 45, color: 'hsl(var(--chart-1))' },
  { name: 'Home & Garden', value: 25, color: 'hsl(var(--chart-2))' },
  { name: 'Fashion', value: 18, color: 'hsl(var(--chart-3))' },
  { name: 'Sports', value: 12, color: 'hsl(var(--chart-4))' },
];

const buyBoxData = [
  { date: 'Week 1', won: 68, lost: 32 },
  { date: 'Week 2', won: 72, lost: 28 },
  { date: 'Week 3', won: 65, lost: 35 },
  { date: 'Week 4', won: 78, lost: 22 },
];

const repricingData = [
  { date: 'Mon', changes: 45, wins: 32 },
  { date: 'Tue', changes: 52, wins: 38 },
  { date: 'Wed', changes: 38, wins: 28 },
  { date: 'Thu', changes: 61, wins: 45 },
  { date: 'Fri', changes: 48, wins: 35 },
  { date: 'Sat', changes: 33, wins: 25 },
  { date: 'Sun', changes: 28, wins: 21 },
];

export default function Analytics() {
  const stats = [
    { label: 'Total Revenue', value: 'R 127,500', change: '+18.2%', icon: DollarSign },
    { label: 'Total Orders', value: '1,424', change: '+12.5%', icon: ShoppingCart },
    { label: 'Active Products', value: '156', change: '+8', icon: Package },
    { label: 'Avg. Profit Margin', value: '24.5%', change: '+2.1%', icon: TrendingUp },
  ];

  return (
    <DashboardLayout title="Analytics" subtitle="Detailed insights into your store performance">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm font-medium text-success">{stat.change}</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="buybox">Buy Box</TabsTrigger>
          <TabsTrigger value="repricing">Repricing</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-display">Revenue & Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} name="Revenue" />
                      <Area type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} name="Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span>{cat.name}</span>
                      </div>
                      <span className="font-medium">{cat.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="buybox" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Buy Box Win Rate Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buyBoxData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="won" name="Won" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lost" name="Lost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Repricing Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={repricingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="changes" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Price Changes" dot={{ fill: 'hsl(var(--chart-1))' }} />
                    <Line type="monotone" dataKey="wins" stroke="hsl(var(--success))" strokeWidth={2} name="Buy Box Wins" dot={{ fill: 'hsl(var(--success))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
