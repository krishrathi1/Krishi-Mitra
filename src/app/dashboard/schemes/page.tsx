"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, ArrowLeft, MapPin, Search, CheckCircle2, 
  FileText, PhoneCall, Building2, Sparkles, Filter, 
  HelpCircle, ChevronRight, CheckSquare, ExternalLink
} from "lucide-react";
import { 
  ALL_INDIA_SCHEMES_DIRECTORY, 
  ALL_INDIAN_STATES_FILTER, 
  type SchemeDetail 
} from "@/lib/schemes-master-data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SchemeNavigatorClient } from "./_components/scheme-navigator-client";
import { useTranslation } from "@/contexts/language-context";
import { useLocation } from "@/contexts/location-context";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIES = [
  "All Categories",
  "Financial Assistance",
  "Crop Insurance & Relief",
  "Solar & Irrigation",
  "Machinery Subsidy",
  "Credit & Loan Waiver",
  "Organic & Natural Farming",
  "Horticulture & Orchards",
] as const;

const CATEGORY_MAP: Record<string, { en: string; hi: string }> = {
  "All Categories": { en: "All Categories", hi: "सभी श्रेणियां" },
  "Financial Assistance": { en: "Financial Assistance", hi: "वित्तीय सहायता" },
  "Crop Insurance & Relief": { en: "Crop Insurance & Relief", hi: "फसल बीमा एवं राहत" },
  "Solar & Irrigation": { en: "Solar & Irrigation", hi: "सौर ऊर्जा एवं सिंचाई" },
  "Machinery Subsidy": { en: "Machinery Subsidy", hi: "कृषि यंत्र सब्सिडी" },
  "Credit & Loan Waiver": { en: "Credit & Loan Waiver", hi: "ऋण एवं केसीसी" },
  "Organic & Natural Farming": { en: "Organic & Natural Farming", hi: "जैविक एवं प्राकृतिक खेती" },
  "Horticulture & Orchards": { en: "Horticulture & Orchards", hi: "बागवानी एवं फल" },
};

const STATE_NAMES_LOCALIZED: Record<string, { en: string; hi: string }> = {
  'all': { en: 'All India (Central Schemes)', hi: 'संपूर्ण भारत (केंद्रीय योजनाएं)' },
  'uttarakhand': { en: 'Uttarakhand', hi: 'उत्तराखंड' },
  'punjab': { en: 'Punjab', hi: 'पंजाब' },
  'haryana': { en: 'Haryana', hi: 'हरियाणा' },
  'uttar-pradesh': { en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश' },
  'maharashtra': { en: 'Maharashtra', hi: 'महाराष्ट्र' },
  'karnataka': { en: 'Karnataka', hi: 'कर्नाटक' },
  'tamil-nadu': { en: 'Tamil Nadu', hi: 'तमिलनाडु' },
  'rajasthan': { en: 'Rajasthan', hi: 'राजस्थान' },
  'madhya-pradesh': { en: 'Madhya Pradesh', hi: 'मध्य प्रदेश' },
  'gujarat': { en: 'Gujarat', hi: 'गुजरात' },
  'bihar': { en: 'Bihar', hi: 'बिहार' },
  'west-bengal': { en: 'West Bengal', hi: 'पश्चिम बंगाल' },
  'andhra-pradesh': { en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' },
  'telangana': { en: 'Telangana', hi: 'तेलंगाना' },
  'odisha': { en: 'Odisha', hi: 'ओडिशा' },
  'kerala': { en: 'Kerala', hi: 'केरल' },
  'himachal-pradesh': { en: 'Himachal Pradesh', hi: 'हिमाचल प्रदेश' },
  'assam': { en: 'Assam', hi: 'असम' },
  'chhattisgarh': { en: 'Chhattisgarh', hi: 'छत्तीसगढ़' },
  'jharkhand': { en: 'Jharkhand', hi: 'झारखंड' },
  'jammu-and-kashmir': { en: 'Jammu and Kashmir', hi: 'जम्मू और कश्मीर' },
  'delhi': { en: 'Delhi', hi: 'दिल्ली' },
  'goa': { en: 'Goa', hi: 'गोवा' },
  'tripura': { en: 'Tripura', hi: 'त्रिपुरा' },
  'meghalaya': { en: 'Meghalaya', hi: 'मेघालय' },
  'manipur': { en: 'Manipur', hi: 'मणिपुर' },
  'mizoram': { en: 'Mizoram', hi: 'मिजोरम' },
  'nagaland': { en: 'Nagaland', hi: 'नागालैंड' },
  'arunachal-pradesh': { en: 'Arunachal Pradesh', hi: 'अरुणाचल प्रदेश' },
  'sikkim': { en: 'Sikkim', hi: 'सिक्किम' },
  'chandigarh': { en: 'Chandigarh', hi: 'चंडीगढ़' },
  'puducherry': { en: 'Puducherry', hi: 'पुडुचेरी' },
};

export default function SchemeNavigatorPage() {
  const { t, language } = useTranslation();
  const { userProfile } = useAuth();
  const { location: sharedLocation } = useLocation();
  const isHindi = language === 'hi';

  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeScheme, setActiveScheme] = useState<SchemeDetail | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [eligibilityCheckResult, setEligibilityCheckResult] = useState<string | null>(null);
  const [checkedDocuments, setCheckedDocuments] = useState<Record<string, boolean>>({});

  // Auto-select user's state from shared location or profile if available
  useEffect(() => {
    if (sharedLocation?.state) {
      const stateQuery = sharedLocation.state.toLowerCase();
      const match = ALL_INDIAN_STATES_FILTER.find(
        (s) => s.code !== "all" && (s.name.toLowerCase() === stateQuery || s.code === stateQuery)
      );
      if (match) {
        setSelectedState(match.code);
        return;
      }
    }
    if (userProfile?.location) {
      const loc = userProfile.location.toLowerCase();
      const match = ALL_INDIAN_STATES_FILTER.find(
        (s) => s.code !== "all" && loc.includes(s.name.toLowerCase())
      );
      if (match) {
        setSelectedState(match.code);
      }
    }
  }, [sharedLocation?.state, userProfile?.location]);

  // Reset eligibility checker when opening a new scheme modal
  const handleOpenSchemeDetails = (scheme: SchemeDetail) => {
    setActiveScheme(scheme);
    setEligibilityCheckResult(null);
    setCheckedDocuments({});
    setIsDialogOpen(true);
  };

  // Filter schemes across India and selected states
  const filteredSchemes = useMemo(() => {
    return ALL_INDIA_SCHEMES_DIRECTORY.filter((scheme) => {
      // 1. State Filter: 'all' shows central schemes + state schemes if state selected
      if (selectedState !== "all") {
        const matchesState = scheme.stateCode === "all" || scheme.stateCode === selectedState;
        if (!matchesState) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== "All Categories" && scheme.category !== selectedCategory) {
        return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const stateHi = STATE_NAMES_LOCALIZED[scheme.stateCode]?.hi || "";
        const catHi = CATEGORY_MAP[scheme.category]?.hi || "";
        const searchable = `${scheme.title} ${scheme.hindiTitle} ${scheme.benefitSummary} ${scheme.benefitAmount} ${scheme.stateName} ${stateHi} ${catHi} ${scheme.documents.join(" ")}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }, [selectedState, selectedCategory, searchTerm]);

  // Stats for the active filter view
  const centralCount = useMemo(() => 
    filteredSchemes.filter((s) => s.stateCode === "all").length,
    [filteredSchemes]
  );
  const stateCount = useMemo(() => 
    filteredSchemes.filter((s) => s.stateCode !== "all").length,
    [filteredSchemes]
  );

  const selectedStateName = useMemo(() => {
    const s = ALL_INDIAN_STATES_FILTER.find((item) => item.code === selectedState);
    if (!s) return isHindi ? "संपूर्ण भारत" : "All India";
    return isHindi ? (STATE_NAMES_LOCALIZED[s.code]?.hi || s.name) : s.name;
  }, [selectedState, isHindi]);

  const toggleDocumentCheck = (doc: string) => {
    setCheckedDocuments((prev) => ({ ...prev, [doc]: !prev[doc] }));
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 rounded-2xl border border-emerald-500/20">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {t("schemes.directoryBadge") || "National Farmers Direct Benefit Directory"}
            </span>
            <span className="text-xs text-muted-foreground">
              • {t("schemes.inPageGuides") || "In-Page Application Guides"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight">
            {t("schemes.headerTitle") || "Indian Government Agricultural Schemes"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            {t("schemes.headerSubtitle") || "Explore central and state farmer schemes across India with full eligibility criteria, required document checklists, and verified application guides."}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-full shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> 
            {t("schemes.backToDashboard") || "Back to Dashboard"}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Schemes List Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Bar */}
          <Card className="border border-border/80 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* State Dropdown */}
                <div>
                  <label htmlFor="scheme-state" className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    {isHindi ? "1. राज्य / केंद्र शासित प्रदेश चुनें (संपूर्ण भारत)" : "1. Select State / Territory (Whole India)"}
                  </label>
                  <select
                    id="scheme-state"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {ALL_INDIAN_STATES_FILTER.map((st) => (
                      <option key={st.code} value={st.code}>
                        {isHindi ? (STATE_NAMES_LOCALIZED[st.code]?.hi || st.name) : st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div>
                  <label htmlFor="search-schemes" className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                    <Search className="h-3.5 w-3.5 text-emerald-600" />
                    {isHindi ? "2. योजनाएं / सब्सिडी / फसल खोजें" : "2. Search Schemes / Subsidy / Crop"}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-schemes"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={isHindi ? "उदा. किसान सम्मान, सोलर पंप, ट्रैक्टर, फसल बीमा..." : "e.g. Kisan Samman, Solar Pump, Tractor, Apple..."}
                      className="pl-9 h-10 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1.5">
                  <Filter className="h-3 w-3 text-emerald-600" />
                  {isHindi ? "श्रेणी अनुसार फ़िल्टर करें:" : "Filter by Category:"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        selectedCategory === cat
                          ? "bg-emerald-700 text-white border-emerald-800 font-semibold shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {isHindi ? (CATEGORY_MAP[cat]?.hi || cat) : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Filter Metrics */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <span>
                    {isHindi ? "चयनित:" : "Viewing:"} <strong className="text-foreground">{selectedStateName}</strong>
                  </span>
                  <span>
                    {isHindi ? "कुल योजनाएं:" : "Total Schemes:"} <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{filteredSchemes.length}</strong>
                  </span>
                  {selectedState !== "all" && (
                    <span className="text-[11px] text-muted-foreground">
                      {isHindi 
                        ? `(${centralCount} केंद्रीय + ${stateCount} राज्य-विशिष्ट)`
                        : `(${centralCount} Central + ${stateCount} State-specific)`}
                    </span>
                  )}
                </div>
                {(selectedState !== "all" || selectedCategory !== "All Categories" || searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedState("all");
                      setSelectedCategory("All Categories");
                      setSearchTerm("");
                    }}
                  >
                    {isHindi ? "फ़िल्टर रीसेट करें" : "Reset Filters"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Schemes Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredSchemes.map((scheme) => (
              <Card 
                key={scheme.id} 
                className="flex flex-col border border-border/80 hover:border-emerald-500/50 hover:shadow-md transition-all group overflow-hidden bg-card"
              >
                <CardHeader className="p-4 pb-3 space-y-2 border-b bg-muted/10">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
                      {isHindi ? (CATEGORY_MAP[scheme.category]?.hi || scheme.category) : scheme.category}
                    </Badge>
                    <Badge 
                      className={`text-[10px] font-semibold ${
                        scheme.stateCode === "all"
                          ? "bg-blue-600 text-white"
                          : "bg-emerald-700 text-white"
                      }`}
                    >
                      {scheme.stateCode === "all" 
                        ? (isHindi ? "केंद्रीय योजना (अखिल भारतीय)" : "Central Scheme (All India)") 
                        : (isHindi ? `${STATE_NAMES_LOCALIZED[scheme.stateCode]?.hi || scheme.stateName} राज्य` : `${scheme.stateName} State`)}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {isHindi ? (scheme.hindiTitle || scheme.title) : scheme.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5 font-medium">
                      {isHindi ? scheme.title : scheme.hindiTitle}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-4 flex-1 space-y-3 text-xs">
                  {/* Financial Benefit Highlight Pill */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">
                      {isHindi ? "💰 वित्तीय लाभ" : "💰 Financial Benefit"}
                    </span>
                    <p className="font-extrabold text-sm text-emerald-800 dark:text-emerald-300">
                      {scheme.benefitAmount}
                    </p>
                  </div>

                  {/* Summary */}
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">
                      {isHindi ? "योजना का उद्देश्य:" : "Scheme Objective:"}
                    </span>
                    <p className="text-muted-foreground leading-relaxed">{scheme.benefitSummary}</p>
                  </div>

                  {/* Documents Required Preview */}
                  <div>
                    <span className="font-bold text-foreground block mb-1">
                      {isHindi ? "आवश्यक दस्तावेज़:" : "Documents Required:"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {scheme.documents.slice(0, 3).map((doc) => (
                        <span key={doc} className="inline-flex items-center text-[10px] bg-muted px-2 py-0.5 rounded-md text-foreground">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          {doc}
                        </span>
                      ))}
                      {scheme.documents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                          {isHindi ? `+${scheme.documents.length - 3} अन्य` : `+${scheme.documents.length - 3} more`}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>

                {/* Footer with In-Page Details Trigger */}
                <CardFooter className="p-4 pt-2 border-t bg-muted/5 mt-auto">
                  <Button
                    onClick={() => handleOpenSchemeDetails(scheme)}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-all group-hover:scale-[1.01]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{isHindi ? "योजना विवरण देखें एवं आवेदन प्रक्रिया" : "View Scheme Details & Apply In-Page"}</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredSchemes.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20 p-8 space-y-3">
              <p className="text-base font-bold text-foreground">
                {isHindi ? "वर्तमान फ़िल्टर से मेल खाती कोई योजना नहीं मिली।" : "No schemes found matching current filters."}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHindi 
                  ? "राज्य में 'संपूर्ण भारत' चुनें या खोज शब्द बदलें।" 
                  : "Try selecting 'All India' in the state dropdown or reset your search keywords."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedState("all");
                  setSelectedCategory("All Categories");
                  setSearchTerm("");
                }}
              >
                {isHindi ? "सभी फ़िल्टर रीसेट करें" : "Reset All Filters"}
              </Button>
            </div>
          )}
        </div>

        {/* AI Scheme Advisor Assistant Column */}
        <div className="lg:col-span-1 space-y-6">
          <SchemeNavigatorClient />
        </div>
      </div>

      {/* ========================================================= */}
      {/* IN-PAGE SCHEME DETAILS & APPLICATION MODAL (NO REDIRECT) */}
      {/* ========================================================= */}
      {activeScheme && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl">
            {/* Modal Header */}
            <DialogHeader className="p-5 pb-3 border-b bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300">
                  {isHindi ? (CATEGORY_MAP[activeScheme.category]?.hi || activeScheme.category) : activeScheme.category}
                </Badge>
                <Badge className={activeScheme.stateCode === "all" ? "bg-blue-600 text-white text-xs" : "bg-emerald-700 text-white text-xs"}>
                  {activeScheme.stateCode === "all" 
                    ? (isHindi ? "केंद्रीय सरकार (अखिल भारतीय)" : "Central Govt (All India)") 
                    : (isHindi ? `${STATE_NAMES_LOCALIZED[activeScheme.stateCode]?.hi || activeScheme.stateName} राज्य` : `${activeScheme.stateName} State`)}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold font-headline text-foreground leading-snug">
                {isHindi ? (activeScheme.hindiTitle || activeScheme.title) : activeScheme.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                {isHindi ? activeScheme.title : activeScheme.hindiTitle}
              </DialogDescription>
            </DialogHeader>

            {/* Modal Scrollable Body */}
            <ScrollArea className="flex-1 p-5 overflow-y-auto max-h-[calc(85vh-160px)]">
              <div className="space-y-5">
                {/* Financial Benefit Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-semibold uppercase tracking-wider">
                    {isHindi ? "सुनिश्चित वित्तीय सहायता" : "Guaranteed Financial Assistance"}
                  </div>
                  <div className="text-xl sm:text-2xl font-black">
                    {activeScheme.benefitAmount}
                  </div>
                  <p className="text-xs text-emerald-100/90 pt-0.5">
                    {activeScheme.benefitSummary}
                  </p>
                </div>

                {/* Tabs for In-Page Organization */}
                <Tabs defaultValue="benefits" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-9 text-xs">
                    <TabsTrigger value="benefits" className="text-xs">{isHindi ? "लाभ" : "Benefits"}</TabsTrigger>
                    <TabsTrigger value="eligibility" className="text-xs">{isHindi ? "पात्रता" : "Eligibility"}</TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs">{isHindi ? "दस्तावेज़" : "Documents"}</TabsTrigger>
                    <TabsTrigger value="steps" className="text-xs">{isHindi ? "आवेदन प्रक्रिया" : "Apply Guide"}</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Detailed Benefits */}
                  <TabsContent value="benefits" className="pt-3 space-y-3 text-xs">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      {isHindi ? "आपको क्या लाभ मिलेगा:" : "What You Will Receive:"}
                    </h3>
                    <ul className="space-y-2">
                      {activeScheme.detailedBenefits.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-muted/30 p-2.5 rounded-lg border border-border/50 text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </TabsContent>

                  {/* Tab 2: Eligibility Criteria */}
                  <TabsContent value="eligibility" className="pt-3 space-y-3 text-xs">
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1.5">
                        {isHindi ? "कौन आवेदन कर सकता है (पात्रता):" : "Who Can Apply (Eligible):"}
                      </h3>
                      <ul className="space-y-1.5">
                        {activeScheme.eligibility.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {activeScheme.ineligibility && activeScheme.ineligibility.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide mb-1.5">
                          {isHindi ? "कौन आवेदन नहीं कर सकता (अपात्र / अपवाद):" : "Who Cannot Apply (Ineligible / Exclusions):"}
                        </h3>
                        <ul className="space-y-1 text-muted-foreground">
                          {activeScheme.ineligibility.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Interactive In-Page Eligibility Checker */}
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 mt-3">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isHindi ? "तत्काल इन-पेज पात्रता जांच" : "Instant In-Page Eligibility Check"}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {isHindi 
                          ? `यह जांचने के लिए अपनी किसान श्रेणी चुनें कि क्या आप ${activeScheme.hindiTitle || activeScheme.title} के लिए पात्र हैं:` 
                          : `Select your farmer category below to check if you qualify for ${activeScheme.title}:`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => setEligibilityCheckResult(
                            isHindi 
                              ? "✅ आप 100% पात्र हैं! इस योजना के लिए लघु एवं सीमांत किसानों (< 2 हेक्टेयर) को प्राथमिकता दी जाती है।"
                              : "✅ You are 100% Eligible! Small & marginal farmers (< 2 hectares) are prioritized for this scheme."
                          )}
                        >
                          {isHindi ? "लघु / सीमांत किसान (< 2 हेक्टेयर)" : "Small / Marginal Farmer (< 2 ha)"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => setEligibilityCheckResult(
                            isHindi 
                              ? "✅ आप पात्र हैं! सामान्य दिशानिर्देशों के तहत मध्यम और बड़े भूमिधारक भी पात्र हैं।"
                              : "✅ You are Eligible! Medium and large landholders qualify under the standard guidelines."
                          )}
                        >
                          {isHindi ? "मध्यम / बड़े किसान" : "Medium / Large Landholder"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => setEligibilityCheckResult(
                            isHindi 
                              ? "ℹ️ बटाईदार / पट्टेदार: बोआई प्रमाण पत्र या पट्टा अनुबंध के साथ राज्य-अधिसूचित घटकों के तहत पात्र।"
                              : "ℹ️ Tenant / Sharecropper: Eligible under state-notified components with sowing certificate or lease deed."
                          )}
                        >
                          {isHindi ? "बटाईदार / पट्टेदार किसान" : "Tenant / Sharecropper"}
                        </Button>
                      </div>
                      {eligibilityCheckResult && (
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 text-xs font-medium border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
                          {eligibilityCheckResult}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tab 3: Required Documents Checklist */}
                  <TabsContent value="documents" className="pt-3 space-y-3 text-xs">
                    <p className="text-muted-foreground">
                      {isHindi 
                        ? "आवेदन निरस्त होने से बचाने के लिए ये दस्तावेज़ तैयार रखें। चेक करने के लिए क्लिक करें:" 
                        : "Keep these documents ready to avoid application rejection. Click each item to mark it checked:"}
                    </p>
                    <div className="space-y-2">
                      {activeScheme.documents.map((doc, idx) => (
                        <div
                          key={idx}
                          onClick={() => toggleDocumentCheck(doc)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                            checkedDocuments[doc]
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                              : "bg-muted/30 border-border/50 text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare className={`h-4 w-4 ${checkedDocuments[doc] ? "text-emerald-600" : "text-muted-foreground"}`} />
                            <span>{doc}</span>
                          </span>
                          {checkedDocuments[doc] && (
                            <Badge className="bg-emerald-700 text-white text-[10px] h-4 px-1.5">
                              {isHindi ? "तैयार" : "Ready"}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Tab 4: In-Page Step-by-Step Application Walkthrough */}
                  <TabsContent value="steps" className="pt-3 space-y-3 text-xs">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      {isHindi ? "चरणबद्ध आवेदन प्रक्रिया:" : "Step-by-Step Application Procedure:"}
                    </h3>
                    <div className="space-y-2.5">
                      {activeScheme.applicationSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-muted/20 p-3 rounded-lg border border-border/60">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <span className="text-foreground leading-relaxed pt-0.5">{step}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Nodal Department & Helpline Box */}
                <div className="p-3.5 rounded-xl border bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px] mb-0.5">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                      {isHindi ? "नोडल विभाग:" : "Nodal Department:"}
                    </span>
                    <p className="font-semibold text-foreground">{activeScheme.nodalDepartment}</p>
                  </div>
                  <div>
                    <span className="flex items-center gap-1.5 font-bold text-muted-foreground text-[11px] mb-0.5">
                      <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                      {isHindi ? "टोल-फ्री किसान हेल्पलाइन:" : "Toll-Free Farmer Helpline:"}
                    </span>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">{activeScheme.helpline}</p>
                  </div>
                </div>

                {/* Frequently Asked Questions */}
                {activeScheme.faqs && activeScheme.faqs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50 text-xs">
                    <span className="flex items-center gap-1 font-bold text-foreground text-xs">
                      <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
                      {isHindi ? "अक्सर पूछे जाने वाले प्रश्न (FAQ):" : "Frequently Asked Questions (FAQ):"}
                    </span>
                    {activeScheme.faqs.map((faq, idx) => (
                      <div key={idx} className="bg-muted/20 p-2.5 rounded-lg border border-border/40 space-y-1">
                        <p className="font-bold text-foreground">Q: {faq.question}</p>
                        <p className="text-muted-foreground">A: {faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Modal Footer with Official URL and Verification details */}
            <DialogFooter className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex flex-col text-left text-[11px] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {language === 'hi' ? "आधिकारिक पोर्टल:" : "Official Portal:"}
                  </span>
                  <a 
                    href={`https://${activeScheme.officialPortalName}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>{activeScheme.officialPortalName}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span>
                    {language === 'hi' ? "सत्यापित स्रोत:" : "Verified Source:"} {activeScheme.nodalDepartment}
                  </span>
                  <span>•</span>
                  <span>
                    {language === 'hi' ? "सत्यापन तिथि: 15 जनवरी 2025" : "Verified: Jan 15, 2025"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => setIsDialogOpen(false)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-5 rounded-full shrink-0"
              >
                {language === 'hi' ? "योजना विवरण बंद करें" : "Close Scheme Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
