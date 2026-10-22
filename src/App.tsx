import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import FlowLayout from "./components/printf/flow/FlowLayout";
import { RouteSkeleton } from "./components/printf/loading/Skeletons";
import NotFound from "./pages/NotFound";

const PrintersPage = lazy(() => import("./pages/flow/PrintersPage"));
const UploadPage = lazy(() => import("./pages/flow/UploadPage"));
const ProcessingPage = lazy(() => import("./pages/flow/ProcessingPage"));
const SettingsPage = lazy(() => import("./pages/flow/SettingsPage"));
const PaymentPage = lazy(() => import("./pages/flow/PaymentPage"));
const EmailOtpPage = lazy(() => import("./pages/flow/EmailOtpPage"));
const StatusPage = lazy(() => import("./pages/flow/StatusPage"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const OrdersAdminPage = lazy(() => import("./pages/admin/OrdersAdminPage"));

import {
  AboutPage,
  ContactPage,
  SupportPage,
  FaqsPage,
  PrivacyPage,
  TermsPage,
  RefundsPage,
} from "./pages/info/InfoPages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route element={<FlowLayout />}>
              <Route path="/" element={<Navigate to="/printers" replace />} />
              <Route path="/printers" element={<PrintersPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/verify-otp" element={<EmailOtpPage />} />
              <Route path="/status" element={<StatusPage />} />
            </Route>
            <Route path="/payment-callback" element={<PaymentCallback />} />
            <Route path="/admin/orders" element={<OrdersAdminPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/refunds" element={<RefundsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
