import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../app/components/firebase";

export interface ResortFeature {
  title: string;
  description: string;
}

export interface ResortSettings {
  resortName: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  frontDeskHours: string;
  features: ResortFeature[];
}

const DEFAULT_SETTINGS: ResortSettings = {
  resortName: "Sabang Beach and Diving Resort",
  description:
    "A tropical getaway offering comfortable accommodations, beautiful beaches, and memorable resort activities.",
  address: "",
  phone: "",
  email: "",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  frontDeskHours: "24/7",
  features: [
    {
      title: "PADI-Certified Diving",
      description:
        "Expert dive masters with 15+ years guiding guests through 50+ local dive sites.",
    },
    {
      title: "Safety First",
      description:
        "International safety standards, first aid certified staff, and emergency protocols at every activity.",
    },
    {
      title: "Award-Winning Service",
      description:
        "TripAdvisor Certificate of Excellence for 5 consecutive years.",
    },
    {
      title: "Pristine Location",
      description:
        "Nestled in a protected marine sanctuary with unparalleled biodiversity.",
    },
  ],
};

export function useResortSettings() {
  const [settings, setSettings] = useState<ResortSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, "publicSettings", "general");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
          return;
        }

        const data = snapshot.data();

        const features = DEFAULT_SETTINGS.features.map(
          (defaultFeature, index) => {
            const featureNumber = index + 1;

            const title = data[`feature${featureNumber}Title`];
            const description = data[`feature${featureNumber}Description`];

            return {
              title:
                typeof title === "string" && title.trim()
                  ? title.trim()
                  : defaultFeature.title,
              description:
                typeof description === "string" && description.trim()
                  ? description.trim()
                  : defaultFeature.description,
            };
          },
        );

        setSettings({
          resortName:
            typeof data.resortName === "string" && data.resortName.trim()
              ? data.resortName.trim()
              : DEFAULT_SETTINGS.resortName,

          description:
            typeof data.description === "string" && data.description.trim()
              ? data.description.trim()
              : DEFAULT_SETTINGS.description,

          address: typeof data.address === "string" ? data.address : "",

          phone: typeof data.phone === "string" ? data.phone : "",

          email: typeof data.email === "string" ? data.email : "",

          checkInTime:
            typeof data.checkInTime === "string"
              ? data.checkInTime
              : DEFAULT_SETTINGS.checkInTime,

          checkOutTime:
            typeof data.checkOutTime === "string"
              ? data.checkOutTime
              : DEFAULT_SETTINGS.checkOutTime,

          frontDeskHours:
            typeof data.frontDeskHours === "string"
              ? data.frontDeskHours
              : DEFAULT_SETTINGS.frontDeskHours,

          features,
        });

        setLoading(false);
      },
      (error) => {
        console.error("Failed to load public resort settings:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return { settings, loading };
}
