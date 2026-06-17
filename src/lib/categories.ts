import coffee from "@/assets/cat-coffee.jpg";
import chai from "@/assets/cat-chai.jpg";
import parathas from "@/assets/cat-parathas.jpg";
import snacks from "@/assets/cat-snacks.jpg";
import beverages from "@/assets/cat-beverages.jpg";
import desserts from "@/assets/cat-desserts.jpg";

export const CATEGORY_IMAGES: Record<string, string> = {
  Coffee: coffee,
  "Chai & Tea": chai,
  Parathas: parathas,
  Snacks: snacks,
  Beverages: beverages,
  Desserts: desserts,
};

export const CATEGORY_BLURBS: Record<string, string> = {
  Coffee: "Single-origin espresso, lattes & cold brew.",
  "Chai & Tea": "Desi doodh patti, karak & Kashmiri chai.",
  Parathas: "Flaky aloo, cheese, qeema & more.",
  Snacks: "Sandwiches, wings, fries & bites.",
  Beverages: "Lassi, fresh limes & mocktails.",
  Desserts: "Brownies, cheesecake & sweet treats.",
};

export function categoryImage(category: string, fallback?: string | null) {
  return fallback || CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Coffee;
}