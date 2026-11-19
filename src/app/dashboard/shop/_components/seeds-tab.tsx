"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sprout,
  Wheat,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Sparkles,
  Award,
  Tag,
  Package,
} from "lucide-react";
import { VERIFIED_SEEDS, type SeedProduct } from "@/lib/store-agri-inputs-data";
import type { AgriInquiryItem } from "./agri-inquiry-dialog";

const CROP_CATEGORIES = [
  "All Crops",
  "Wheat",
  "Paddy / Rice",
  "Mustard",
  "Cotton",
  "Soybean",
  "Pulses",
] as const;

interface SeedsTabProps {
  locationQuery?: string;
  selectedState?: string;
  onOpenInquiry: (item: AgriInquiryItem) => void;
}

export function SeedsTab({
  locationQuery = "",
  selectedState = "all",
  onOpenInquiry,
}: SeedsTabProps) {
  const [selectedCrop, setSelectedCrop] = useState<string>("All Crops");
  const [seedSearch, setSeedSearch] = useState<string>("");

  const filteredSeeds = useMemo(() => {
    return VERIFIED_SEEDS.filter((seed) => {
      // 1. Crop category
      if (selectedCrop !== "All Crops" && seed.cropType !== selectedCrop) {
        return false;
      }

      // 2. State filter
      if (
        selectedState !== "all" &&
        seed.dealer.state.toLowerCase() !== selectedState.toLowerCase()
      ) {
        // Still allow if search query matches explicitly or state matches
        const matchesQuery = seedSearch.toLowerCase();
        if (!matchesQuery || !seed.dealer.state.toLowerCase().includes(matchesQuery)) {
          return false;
        }
      }

      // 3. Location text filter
      if (locationQuery.trim() && locationQuery.toLowerCase() !== "all india") {
        const loc = locationQuery.toLowerCase();
        const dealerLoc = `${seed.dealer.city} ${seed.dealer.district} ${seed.dealer.state} ${seed.dealer.address}`.toLowerCase();
        const tokens = loc.split(/[\s,]+/).filter(Boolean);
        const matchesLoc = tokens.some((token) => dealerLoc.includes(token));
        if (!matchesLoc) return false;
      }

      // 4. Keyword search
      if (seedSearch.trim()) {
        const q = seedSearch.toLowerCase().trim();
        const target = `${seed.name} ${seed.variety} ${seed.cropType} ${seed.brandOrSource} ${seed.description} ${seed.dealer.name}`.toLowerCase();
        const words = q.split(/\s+/).filter(Boolean);
        if (!words.every((w) => target.includes(w))) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCrop, selectedState, locationQuery, seedSearch]);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-muted/20 p-4 rounded-xl border">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            Certified High-Yield Agricultural Seeds
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified National Seeds Corporation (NSC), ICAR, and State Beej Nigam certified varieties.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-1 md:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search variety e.g. HD-3086, Basmati, Pioneer..."
              value={seedSearch}
              onChange={(e) => setSeedSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Crop Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1 mr-1">
          <Filter className="h-3 w-3 text-emerald-600" /> Crops:
        </span>
        {CROP_CATEGORIES.map((crop) => (
          <button
            key={crop}
            onClick={() => setSelectedCrop(crop)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-all ${
              selectedCrop === crop
                ? "bg-emerald-700 text-white font-bold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
            }`}
          >
            {crop}
          </button>
        ))}
      </div>

      {/* Seeds Grid */}
      {filteredSeeds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSeeds.map((seed) => {
            const inquiryItem: AgriInquiryItem = {
              type: "seed",
              title: seed.name,
              price: seed.price,
              packSize: seed.packSize,
              dealer: seed.dealer,
              subsidyEligible: seed.subsidyEligible,
            };

            const whatsappUrl = seed.dealer.whatsapp
              ? `https://wa.me/${seed.dealer.whatsapp.replace(/\+/g, "")}?text=${encodeURIComponent(
                  `Namaste, I want to inquire about ${seed.name} (${seed.packSize}) priced at ${seed.price} on Krishi-Mitra platform.`
                )}`
              : null;

            return (
              <Card
                key={seed.id}
                className="border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group bg-card"
              >
                <div>
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold text-[11px]"
                      >
                        <Award className="h-3 w-3 mr-1 text-emerald-600" />
                        {seed.certificationTag}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {seed.season}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-foreground leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {seed.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Brand / Developer: {seed.brandOrSource}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-xs">
                    {/* Price and Pack Size */}
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                            {seed.price}
                          </span>
                          {seed.originalPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {seed.originalPrice}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Pack: <strong>{seed.packSize}</strong>
                        </span>
                      </div>

                      {seed.subsidyEligible && (
                        <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] text-right font-semibold">
                          Govt Subsidy
                        </Badge>
                      )}
                    </div>

                    {/* Quality & Traits Grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] text-center">
                      <div className="p-1.5 rounded-lg bg-background border">
                        <span className="text-muted-foreground block text-[10px]">Germination</span>
                        <strong className="text-foreground">{seed.germinationRate}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background border">
                        <span className="text-muted-foreground block text-[10px]">Purity</span>
                        <strong className="text-foreground">{seed.purity.split(" ")[0]}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background border">
                        <span className="text-muted-foreground block text-[10px]">Maturity</span>
                        <strong className="text-foreground">{seed.maturityDays.split(" ")[0]} d</strong>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {seed.description}
                    </p>

                    {/* Dealer Info Strip */}
                    <div className="pt-2 border-t border-border/50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1 truncate">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {seed.dealer.name}
                        </span>
                        <span className="text-[10px] shrink-0 font-medium text-emerald-700">
                          {seed.dealer.distance}
                        </span>
                      </div>
                      <p className="text-muted-foreground flex items-center gap-1 text-[10px] truncate">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        {seed.dealer.city}, {seed.dealer.state}
                      </p>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-0 pb-3 flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
                    >
                      <a href={`tel:${seed.dealer.phone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" /> Call
                      </a>
                    </Button>
                    {whatsappUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
                      >
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>

                  <Button
                    onClick={() => onOpenInquiry(inquiryItem)}
                    className="w-full h-8 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    <Package className="h-3.5 w-3.5 mr-1.5" /> Book / Inquire Stock
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-2 border-dashed p-8 text-center space-y-3 bg-muted/10">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Sprout className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-base">No Seeds Found for Selected Filter</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try switching the crop category or clear your search to view certified seeds across other districts and states.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedCrop("All Crops");
              setSeedSearch("");
            }}
          >
            Reset Seed Filters
          </Button>
        </Card>
      )}
    </div>
  );
}
