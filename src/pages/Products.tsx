import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { z } from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Package, RefreshCw, Image as ImageIcon, ShoppingCart } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Fixed user ID for private use
const PRIVATE_USER_ID = '00000000-0000-0000-0000-000000000001';

interface Product {
  id: string;
  sku: string;
  title: string;
  current_price: number;
  min_price: number | null;
  max_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  buy_box_status: string | null;
  image_url: string | null;
}

interface Sale {
  id: string;
  order_id: string | null;
  quantity: number;
  sale_price: number;
  sold_at: string;
  product: {
    title: string | null;
    sku: string | null;
  } | null;
}

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100, 'SKU too long'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  current_price: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Must be a positive number'),
  min_price: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), 'Must be a positive number'),
  max_price: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), 'Must be a positive number'),
  cost_price: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), 'Must be a positive number'),
  stock_quantity: z.string().optional().refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0), 'Must be a positive number'),
});

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    title: '',
    current_price: '',
    min_price: '',
    max_price: '',
    cost_price: '',
    stock_quantity: '',
  });

  const { data: products, isLoading } = useQuery<Product[]>({ // Specify type here
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', PRIVATE_USER_ID)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Product[]; // Cast data here
    },
  });

  const addProduct = useMutation({
    mutationFn: async (data: typeof formData) => {
      const validated = productSchema.parse(data);
      const { error } = await supabase.from('products').insert({
        user_id: PRIVATE_USER_ID,
        sku: validated.sku,
        title: validated.title,
        current_price: parseFloat(validated.current_price),
        min_price: validated.min_price ? parseFloat(validated.min_price) : null,
        max_price: validated.max_price ? parseFloat(validated.max_price) : null,
        cost_price: validated.cost_price ? parseFloat(validated.cost_price) : null,
        stock_quantity: validated.stock_quantity ? parseInt(validated.stock_quantity) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product added successfully');
      setIsOpen(false);
      setFormData({ sku: '', title: '', current_price: '', min_price: '', max_price: '', cost_price: '', stock_quantity: '' });
    },
    onError: (error) => {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : error.message);
    },
  });

  const syncProducts = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-takealot-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Synced ${data.synced} products (${data.created} new, ${data.updated} updated)`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
  });

  const filteredProducts = products?.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getBuyBoxBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge className="buy-box-won">Won</Badge>;
      case 'lost':
        return <Badge className="buy-box-lost">Lost</Badge>;
      default:
        return <Badge className="buy-box-unknown">Unknown</Badge>;
    }
  };

  const { data: sales } = useQuery<Sale[]>({ // Specify type here
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          product:products(title, sku)
        `)
        .eq('user_id', PRIVATE_USER_ID)
        .order('sold_at', { ascending: false });
      if (error) throw error;
      return data as Sale[]; // Cast data here
    },
  });

  return (
    <DashboardLayout title="Products" subtitle="Manage your Takealot product listings">
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="products">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Product Inventory</CardTitle>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => syncProducts.mutate()}
              disabled={syncProducts.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncProducts.isPending ? 'animate-spin' : ''}`} />
              Sync from Takealot
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Add New Product</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addProduct.mutate(formData); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock Quantity</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Product Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="current_price">Current Price (R)</Label>
                      <Input
                        id="current_price"
                        type="number"
                        step="0.01"
                        value={formData.current_price}
                        onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost_price">Cost Price (R)</Label>
                      <Input
                        id="cost_price"
                        type="number"
                        step="0.01"
                        value={formData.cost_price}
                        onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_price">Min Price (R)</Label>
                      <Input
                        id="min_price"
                        type="number"
                        step="0.01"
                        value={formData.min_price}
                        onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_price">Max Price (R)</Label>
                      <Input
                        id="max_price"
                        type="number"
                        step="0.01"
                        value={formData.max_price}
                        onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={addProduct.isPending}>
                    Add Product
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Package className="w-8 h-8 animate-pulse text-muted-foreground" />
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No products yet</h3>
              <p className="text-muted-foreground mb-4">Click \"Sync from Takealot\" to import your products</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts?.map((product: Product) => (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '';
                          e.currentTarget.parentElement!.classList.add('bg-muted');
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                        <h3 className="font-semibold line-clamp-2 text-sm">{product.title}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-accent">R {Number(product.current_price).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</p>
                        </div>
                        {getBuyBoxBadge(product.buy_box_status || 'unknown')}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="flex-1">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-destructive"
                          onClick={() => deleteProduct.mutate(product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              {!sales || sales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No sales yet</h3>
                  <p className="text-muted-foreground">Sales will appear here as orders are received</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Sale Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: Sale) => {
                      const saleTotal = (Number(sale.sale_price) || 0) * (sale.quantity || 1);
                      const saleDate = new Date(sale.sold_at).toLocaleDateString('en-ZA', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      });
                      return (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono text-sm">{sale.order_id}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{sale.product?.title || 'Unknown'}</TableCell>
                          <TableCell className="font-mono text-sm">{sale.product?.sku || 'N/A'}</TableCell>
                          <TableCell>{sale.quantity}</TableCell>
                          <TableCell>R {Number(sale.sale_price).toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">R {saleTotal.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{saleDate}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
