"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, MessageSquare, CheckCircle2, ShieldCheck, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { AgriInputDealer } from "@/lib/store-agri-inputs-data";

export interface AgriInquiryItem {
  type: "seed" | "fertilizer";
  title: string;
  price: string;
  packSize: string;
  dealer: AgriInputDealer;
  subsidyEligible?: boolean;
}

interface AgriInquiryDialogProps {
  item: AgriInquiryItem | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFarmerName?: string;
  defaultFarmerPhone?: string;
}

export function AgriInquiryDialog({
  item,
  isOpen,
  onClose,
  defaultFarmerName = "",
  defaultFarmerPhone = "",
}: AgriInquiryDialogProps) {
  const [name, setName] = useState(defaultFarmerName);
  const [phone, setPhone] = useState(defaultFarmerPhone);
  const [quantity, setQuantity] = useState("2");
  const [inquiryType, setInquiryType] = useState("Order Booking & Home Delivery");

  if (!item) return null;

  const handleSubmit = () => {
    onClose();
    toast({
      title: "✅ Booking / Inquiry Sent to Dealer!",
      description: `${item.dealer.name} representative will call you at ${phone || 'your number'} with delivery & subsidy details.`,
    });
  };

  const whatsappUrl = item.dealer.whatsapp
    ? `https://wa.me/${item.dealer.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(
        `Namaste, I want to inquire about ${item.title} (${item.packSize}) priced at ${item.price} on Krishi-Mitra platform.`
      )}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-600" />
            {item.type === "seed" ? "Seed Booking & Availability" : "Fertilizer / Manure Inquiry"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Connect directly with verified dealer {item.dealer.name} for official rates & subsidies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Item summary banner */}
          <div className="p-3 bg-muted/40 rounded-xl border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-sm">{item.title}</span>
              <Badge variant="secondary" className="font-bold text-emerald-700 dark:text-emerald-400">
                {item.price}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Pack Size: <strong>{item.packSize}</strong> {item.subsidyEligible ? "• Govt Subsidy Eligible" : ""}
            </p>
            <div className="pt-1 border-t border-border/50 text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="truncate">{item.dealer.name}, {item.dealer.address}</span>
            </div>
          </div>

          {/* Quick contact dealer directly */}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 text-xs h-8 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
              <a href={`tel:${item.dealer.phone}`}>
                <Phone className="h-3.5 w-3.5 mr-1" /> Call Dealer Directly
              </a>
            </Button>
            {whatsappUrl && (
              <Button asChild variant="outline" size="sm" className="flex-1 text-xs h-8 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Chat WhatsApp
                </a>
              </Button>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase">or request dealer callback</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">Farmer Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Full Name"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">Mobile Number for Callback</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98XXXXXXXX"
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">Required Quantity (Bags/Packs)</label>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 2, 5, 10"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">Inquiry Type</label>
              <select
                value={inquiryType}
                onChange={(e) => setInquiryType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option>Order Booking & Delivery</option>
                <option>Subsidy Eligibility Check</option>
                <option>Bulk Farm Order Quote</option>
                <option>Store Visit & Pickup</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
          >
            Submit Callback Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
