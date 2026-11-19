"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Leaf,
  FlaskConical,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MessageSquare,
  MapPin,
  Sparkles,
  Award,
  Layers,
  Package,
} from "lucide-react";
import { VERIFIED_FERTILIZERS, type FertilizerProduct } from "@/lib/store-agri-inputs-data";
import type { AgriInquiryItem } from "./agri-inquiry-dialog";

const FERTILIZER_TYPES = [
  "All Types",
  "Organic Manure",
  "Bio-Fertilizer",
  "Chemical Fertilizer",
  "Micro-Nutrient",
] as const;

interface FertilizersTabProps {
  locationQuery?: string;
  selectedState?: string;
  onOpenInquiry: (item: AgriInquiryItem) => void;
}

export function FertilizersTab({
  locationQuery = "",
  selectedState = "all",
  onOpenInquiry,
}: FertilizersTabProps) {
  const [selectedType, setSelectedType] = useState<string>("All Types");
  const [fertSearch, setFertSearch] = useState<string>("");

  const filteredFertilizers = useMemo(() => {
    return VERIFIED_FERTILIZERS.filter((fert) => {
      // 1. Type category
      if (selectedType !== "All Types" && fert.type !== selectedType) {
        return false;
      }

      // 2. State filter
      if (
        selectedState !== "all" &&
        fert.dealer.state.toLowerCase() !== selectedState.toLowerCase()
      ) {
        const matchesQuery = fertSearch.toLowerCase();
        if (!matchesQuery || !fert.dealer.state.toLowerCase().includes(matchesQuery)) {
          return false;
        }
      }

      // 3. Location text filter
      if (locationQuery.trim() && locationQuery.toLowerCase() !== "all india") {
        const loc = locationQuery.toLowerCase();
        const dealerLoc = `${fert.dealer.city} ${fert.dealer.district} ${fert.dealer.state} ${fert.dealer.address}`.toLowerCase();
        const tokens = loc.split(/[\s,]+/).filter(Boolean);
        const matchesLoc = tokens.some((token) => dealerLoc.includes(token));
        if (!matchesLoc) return false;
      }

      // 4. Keyword search
      if (fertSearch.trim()) {
        const q = fertSearch.toLowerCase().trim();
        const target = `${fert.name} ${fert.type} ${fert.brandOrSource} ${fert.npkRatio || ""} ${fert.description} ${fert.idealForCrops} ${fert.dealer.name}`.toLowerCase();
        const words = q.split(/\s+/).filter(Boolean);
        if (!words.every((w) => target.includes(w))) {
          return false;
        }
      }

      return true;
    });
  }, [selectedType, selectedState, locationQuery, fertSearch]);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter Header */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-muted/20 p-4 rounded-xl border">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-600" />
            Manure, Organic Compost & Fertilizers
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Government subsidized Urea/DAP, IFFCO Nano fertilizers, Vermicompost & Certified Bio-fertilizers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-1 md:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search e.g. Vermicompost, Nano Urea, DAP, Gypsum..."
              value={fertSearch}
              onChange={(e) => setFertSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Fertilizer Type Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1 mr-1">
          <Filter className="h-3 w-3 text-emerald-600" /> Type:
        </span>
        {FERTILIZER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs transition-all ${
              selectedType === type
                ? "bg-emerald-700 text-white font-bold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Fertilizer Grid */}
      {filteredFertilizers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFertilizers.map((fert) => {
            const inquiryItem: AgriInquiryItem = {
              type: "fertilizer",
              title: fert.name,
              price: fert.price,
              packSize: fert.packSize,
              dealer: fert.dealer,
              subsidyEligible: fert.subsidyEligible,
            };

            const whatsappUrl = fert.dealer.whatsapp
              ? `https://wa.me/${fert.dealer.whatsapp.replace(/\+/g, "")}?text=${encodeURIComponent(
                  `Namaste, I want to inquire about ${fert.name} (${fert.packSize}) priced at ${fert.price} on Krishi-Mitra platform.`
                )}`
              : null;

            return (
              <Card
                key={fert.id}
                className="border hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group bg-card"
              >
                <div>
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`font-bold text-[11px] ${
                          fert.type === "Organic Manure"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                            : fert.type === "Chemical Fertilizer"
                            ? "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300"
                        }`}
                      >
                        {fert.organicCertified ? (
                          <Leaf className="h-3 w-3 mr-1 text-emerald-600" />
                        ) : (
                          <FlaskConical className="h-3 w-3 mr-1 text-blue-600" />
                        )}
                        {fert.type}
                      </Badge>

                      {fert.isGovtSubsidized && (
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                          Govt Subsidized Rate
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-foreground leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {fert.name}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Brand / Source: {fert.brandOrSource}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-xs">
                    {/* Price and Pack Size */}
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                            {fert.price}
                          </span>
                          {fert.originalPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {fert.originalPrice}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Pack: <strong>{fert.packSize}</strong>
                        </span>
                      </div>

                      {fert.npkRatio && (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">NPK Ratio</span>
                          <Badge variant="secondary" className="font-mono text-[10px] font-bold">
                            {fert.npkRatio}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Suitable crops & dosage */}
                    <div className="p-2 rounded-lg bg-background border space-y-1 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Ideal for: </span>
                        <strong className="text-foreground">{fert.idealForCrops}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dosage: </span>
                        <span className="text-foreground">{fert.applicationDosage}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {fert.description}
                    </p>

                    {/* Dealer Info Strip */}
                    <div className="pt-2 border-t border-border/50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1 truncate">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {fert.dealer.name}
                        </span>
                        <span className="text-[10px] shrink-0 font-medium text-emerald-700">
                          {fert.dealer.distance}
                        </span>
                      </div>
                      <p className="text-muted-foreground flex items-center gap-1 text-[10px] truncate">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        {fert.dealer.city}, {fert.dealer.state}
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
                      <a href={`tel:${fert.dealer.phone}`}>
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
                    <Package className="h-3.5 w-3.5 mr-1.5" /> Order / Check Availability
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-2 border-dashed p-8 text-center space-y-3 bg-muted/10">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Leaf className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-base">No Fertilizers / Manures Found for Selected Filter</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try switching the type category or clear your search to view fertilizers and manures across other districts and states.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedType("All Types");
              setFertSearch("");
            }}
          >
            Reset Fertilizer Filters
          </Button>
        </Card>
      )}
    </div>
  );
}
