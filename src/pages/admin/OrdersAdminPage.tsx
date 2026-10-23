import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, Loader2, RefreshCw, ShieldCheck, LogOut } from 'lucide-react';

type OrderDocument = { file_path: string; file_name: string } | null;
type Order = {
  id: string; order_number: number; customer_name: string; customer_mobile: string;
  print_job_id: string | null; amount: number; payment_method: 'razorpay' | 'cod';
  payment_status: string; order_status: string; cod_collected: boolean; created_at: string;
  print_jobs: OrderDocument;
};
const STATUSES = ['pending', 'accepted', 'printing', 'completed', 'cancelled', 'failed'];

export default function OrdersAdminPage() {
  const { user, isAdmin, isLoading: authLoading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from('print_orders')
      .select('id, order_number, customer_name, customer_mobile, print_job_id, amount, payment_method, payment_status, order_status, cod_collected, created_at, print_jobs(file_path, file_name)')
      .order('created_at', { ascending: false }).limit(250);
    if (error) {
      console.error('Could not load orders:', error);
      toast.error('Could not load orders. Check the administrator role and RLS policy.');
    } else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const changeStatus = async (order: Order, nextStatus: string) => {
    if (!STATUSES.includes(nextStatus) || nextStatus === order.order_status) return;

    const jobStatusForOrder: Record<string, string> = {
      pending: 'pending',
      accepted: 'ready',
      printing: 'printing',
      completed: 'completed',
      cancelled: 'expired',
      failed: 'failed',
    };

    if (order.print_job_id) {
      const { data: job, error: lookupError } = await (supabase as any).from('print_jobs')
        .select('id, status, locked').eq('id', order.print_job_id).maybeSingle();
      if (lookupError || !job) {
        toast.error('Could not load the linked print job. No status was changed.');
        return;
      }

      if (job.status === 'completed' && nextStatus !== 'completed') {
        toast.error('A completed print job cannot be moved back to an earlier status.');
        return;
      }
      if (job.status === 'printing' && !['printing', 'completed', 'failed'].includes(nextStatus)) {
        toast.error('A job already printing cannot be moved back to an earlier state. Let it finish or mark it failed if printing actually stopped.');
        return;
      }
      if (['failed', 'expired'].includes(job.status) && !['failed', 'cancelled'].includes(nextStatus)) {
        toast.error('This print job is no longer active. Start a new print job to retry.');
        return;
      }

      const nextJobStatus = jobStatusForOrder[nextStatus];
      const { error: jobUpdateError } = await (supabase as any).from('print_jobs')
        .update({ status: nextJobStatus, locked: nextJobStatus === 'printing' ? job.locked : false })
        .eq('id', job.id);
      if (jobUpdateError) {
        console.error('Could not update print job:', jobUpdateError);
        toast.error('Could not update the linked print job. Check administrator permissions.');
        return;
      }
      // The database trigger syncs print_jobs.status back into the order status.
      // This fallback handles unchanged job states where the trigger won't fire.
    }

    const { error } = await (supabase as any).from('print_orders')
      .update({ order_status: nextStatus }).eq('id', order.id);
    if (error) {
      console.error('Could not update order status:', error);
      toast.error('The print job was updated, but the order record could not be updated. Refresh and inspect the job.');
      await loadOrders();
      return;
    }
    toast.success(`Order #${order.order_number} updated`);
    await loadOrders();
  };

  const markCashCollected = async (order: Order) => {
    if (order.payment_method !== 'cod' || order.order_status !== 'completed') {
      toast.error('Record COD collection only after the print job is completed.');
      return;
    }
    const { error } = await (supabase as any).from('print_orders')
      .update({ cod_collected: true, payment_status: 'paid', cod_collected_at: new Date().toISOString() })
      .eq('id', order.id).eq('payment_method', 'cod').eq('order_status', 'completed').eq('cod_collected', false);
    if (error) { toast.error('Could not mark cash as collected'); return; }
    toast.success(`Cash recorded for order #${order.order_number}`);
    await loadOrders();
  };

  const downloadDocument = async (order: Order) => {
    const document = order.print_jobs;
    if (!document?.file_path) {
      toast.error('This order does not have a document to download.');
      return;
    }
    const { data, error } = await supabase.storage.from('print-files').createSignedUrl(document.file_path, 120);
    if (error || !data?.signedUrl) {
      console.error('Could not create document link:', error);
      toast.error('Could not open the document. Check storage access.');
      return;
    }
    const link = window.document.createElement('a');
    link.href = data.signedUrl;
    link.download = document.file_name || `order-${order.order_number}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (authLoading) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4" onSubmit={async (e) => { e.preventDefault(); await signIn(email, password); }}>
        <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-xl font-bold text-foreground text-center">PrintF Admin Sign In</h1>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" autoComplete="username" required />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required />
        <Button className="w-full" type="submit">Sign in</Button>
      </form>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md text-center space-y-4">
        <ShieldCheck className="h-10 w-10 text-destructive mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Admin access required</h1>
        <p className="text-sm text-muted-foreground">This account does not have the PrintF administrator role.</p>
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  );

  const visibleOrders = statusFilter === 'all' ? orders : orders.filter((order) => order.order_status === statusFilter);
  const codPending = orders.filter(o => o.payment_method === 'cod' && !o.cod_collected && o.order_status !== 'cancelled').length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-muted-foreground">PrintF v2</p><h1 className="text-2xl font-bold">Order Management</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void loadOrders()} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
            <Button variant="ghost" onClick={() => void signOut()}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[{ label: 'Total orders', value: orders.length }, { label: 'COD pending', value: codPending }, { label: 'Printing', value: orders.filter(o => o.order_status === 'printing').length }, { label: 'Completed', value: orders.filter(o => o.order_status === 'completed').length }].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground">{card.label}</p><p className="text-2xl font-bold mt-1">{card.value}</p></div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Customer orders</h2>
          <select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>{STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        {loading && orders.length === 0 ? <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
          <div className="overflow-x-auto border border-border rounded-xl bg-card">
            <table className="min-w-[1120px] w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground"><tr>{['Order / Date', 'Customer', 'Document', 'Amount', 'Payment', 'Print status', 'Cash collection'].map(h => <th key={h} className="text-left font-medium p-3">{h}</th>)}</tr></thead>
              <tbody>
                {visibleOrders.map(order => <tr key={order.id} className="border-t border-border align-top">
                  <td className="p-3"><p className="font-semibold">#{order.order_number}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString('en-IN')}</p></td>
                  <td className="p-3"><p className="font-medium">{order.customer_name}</p><p className="text-muted-foreground">{order.customer_mobile}</p></td>
                  <td className="p-3 max-w-[220px]">{order.print_jobs?.file_path ? <div className="space-y-1"><p className="truncate text-xs" title={order.print_jobs.file_name}>{order.print_jobs.file_name}</p><Button size="sm" variant="outline" onClick={() => void downloadDocument(order)}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button></div> : <span className="text-xs text-muted-foreground">No document</span>}</td>
                  <td className="p-3 font-semibold">₹{Number(order.amount).toFixed(2)}</td>
                  <td className="p-3"><p className="uppercase text-xs font-semibold">{order.payment_method}</p><p className="text-xs text-muted-foreground">{order.payment_status}</p></td>
                  <td className="p-3"><select aria-label={`Status for order ${order.order_number}`} className="h-9 rounded-md border border-border bg-background px-2" value={order.order_status} onChange={(e) => void changeStatus(order, e.target.value)}>{STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></td>
                  <td className="p-3">{order.payment_method !== 'cod' ? <span className="text-muted-foreground">Not applicable</span> : order.cod_collected ? <span className="text-success font-semibold">Collected</span> : <Button size="sm" disabled={order.order_status !== 'completed'} title={order.order_status !== 'completed' ? 'Available after printing is complete' : 'Record received COD cash'} onClick={() => void markCashCollected(order)}>Mark collected</Button>}</td>
                </tr>)}
                {visibleOrders.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={7}>No orders found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
