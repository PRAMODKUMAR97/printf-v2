import { FormEvent, useState } from 'react';
import { Clock, KeyRound, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

type CustomerOrder = {
  order_number: number;
  amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  delivery_otp: string | null;
  print_jobs: { file_name: string; settings_json: { page_count?: number } } | null;
};

export default function OrderHistoryPage() {
  const [mobile, setMobile] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadOrders = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: requestError } = await supabase.functions.invoke('customer-orders', { body: { mobile } });
    if (requestError || !data?.success) {
      setOrders([]);
      setError(data?.error || 'Could not load your orders. Check the mobile number and try again.');
    } else setOrders(data.orders as CustomerOrder[]);
    setLoading(false);
  };

  return <div className="container mx-auto px-6 py-14">
    <div className="mx-auto max-w-xl space-y-6 animate-rise">
      <div><p className="eyebrow">PrintF</p><h1 className="mt-2 font-display text-3xl text-foreground">Your orders</h1><p className="mt-2 text-sm text-muted-foreground">Enter the mobile number used at checkout to see your order status and active delivery OTP.</p></div>
      <form onSubmit={loadOrders} className="panel-raised flex gap-3 p-4">
        <Input aria-label="Mobile number" type="tel" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" maxLength={20} required />
        <Button type="submit" disabled={loading}>{loading ? <Clock className="h-4 w-4 animate-spin" /> : <><Search className="mr-2 h-4 w-4" />Find</>}</Button>
      </form>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {orders.map((order) => <article key={order.order_number} className="panel-raised space-y-3 p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-foreground">Order #{order.order_number}</p><p className="mt-1 text-sm text-muted-foreground">{order.print_jobs?.file_name ?? 'Document'} · {new Date(order.created_at).toLocaleString('en-IN')}</p></div><span className="text-sm font-medium text-foreground">₹{Number(order.amount).toFixed(2)}</span></div>
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Status</span><span className="capitalize text-foreground">{order.order_status === 'completed' ? 'Delivered' : order.order_status}</span></div>
        {order.delivery_otp ? <div className="rounded-xl bg-success/10 p-4 text-center"><p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />Delivery OTP</p><p className="mt-1 font-display text-3xl tracking-[0.28em] text-success">{order.delivery_otp}</p><p className="mt-2 text-xs text-muted-foreground">Tell this code only when the order is delivered.</p></div> : order.order_status === 'completed' ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Delivered — the OTP has expired.</p> : null}
      </article>)}
      {!loading && !error && orders.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Your orders will appear here after you search.</p>}
    </div>
  </div>;
}
