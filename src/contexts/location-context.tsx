"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

export interface SharedLocation {
  country: string;
  state: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  displayName: string;
}

export const DEFAULT_SHARED_LOCATION: SharedLocation = {
  country: "India",
  state: "Madhya Pradesh",
  district: "Sehore",
  city: "Shyampur",
  latitude: 23.2000,
  longitude: 77.0800,
  displayName: "Shyampur, Sehore, Madhya Pradesh, India",
};

const LOCATION_STORAGE_KEY = 'krishi_mitra_shared_location';

interface LocationContextType {
  location: SharedLocation;
  setLocation: (loc: Partial<SharedLocation> | SharedLocation) => void;
  clearLocation: () => void;
  detectLocation: () => Promise<SharedLocation | null>;
  isDetecting: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const { userProfile } = useAuth();
  const [location, setLocationState] = useState<SharedLocation>(DEFAULT_SHARED_LOCATION);
  const [isDetecting, setIsDetecting] = useState(false);

  // Sync from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setLocationState((prev) => ({ ...prev, ...parsed }));
          return;
        }
      }
      // If no saved location, but user profile has location string
      if (userProfile?.location) {
        const parts = userProfile.location.split(',').map((p) => p.trim());
        const locObj: Partial<SharedLocation> = {
          displayName: userProfile.location,
          country: "India",
        };
        if (parts.length === 1) locObj.state = parts[0];
        if (parts.length === 2) {
          locObj.district = parts[0];
          locObj.state = parts[1];
        }
        if (parts.length >= 3) {
          locObj.city = parts[0];
          locObj.district = parts[1];
          locObj.state = parts[2];
        }
        setLocationState((prev) => ({ ...prev, ...locObj }));
      }
    } catch (e) {
      console.warn("Failed to load shared location from localStorage:", e);
    }
  }, [userProfile?.location]);

  const setLocation = useCallback((newLoc: Partial<SharedLocation> | SharedLocation) => {
    setLocationState((prev) => {
      const merged: SharedLocation = {
        ...prev,
        ...newLoc,
        displayName:
          newLoc.displayName ||
          [newLoc.city || prev.city, newLoc.district || prev.district, newLoc.state || prev.state, newLoc.country || prev.country]
            .filter(Boolean)
            .join(', '),
      };
      try {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(DEFAULT_SHARED_LOCATION);
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {}
  }, []);

  const detectLocation = useCallback(async (): Promise<SharedLocation | null> => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Unsupported",
        description: "Your browser does not support GPS location detection.",
        variant: "destructive",
      });
      return null;
    }

    setIsDetecting(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            // Reverse geocode via internal API
            const res = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const data = await res.json();
              const detectedLoc: SharedLocation = {
                country: data.country || "India",
                state: data.state || null,
                district: data.district || null,
                city: data.city || null,
                latitude: lat,
                longitude: lng,
                displayName: data.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              };
              setLocation(detectedLoc);
              setIsDetecting(false);
              resolve(detectedLoc);
              return;
            }
          } catch (e) {
            console.warn("Reverse geocode failed:", e);
          }

          // Fallback if reverse geocode fails
          const fallbackLoc: SharedLocation = {
            country: "India",
            state: null,
            district: null,
            city: null,
            latitude: lat,
            longitude: lng,
            displayName: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
          };
          setLocation(fallbackLoc);
          setIsDetecting(false);
          resolve(fallbackLoc);
        },
        (err) => {
          console.warn("Geolocation permission error:", err);
          setIsDetecting(false);
          toast({
            title: "GPS Access Denied",
            description: "Please allow location permission in your browser or select manually.",
            variant: "destructive",
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, [setLocation]);

  return (
    <LocationContext.Provider
      value={{
        location,
        setLocation,
        clearLocation,
        detectLocation,
        isDetecting,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
