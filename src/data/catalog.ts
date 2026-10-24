// src/data/catalog.ts
// البيانات الثابتة للديمو: المخازن، الأصناف، الألوان، العملاء، الموردين.
// الأسماء والأسعار تقريبية وواقعية لسوق القماش بالجملة، وكلها بيانات عرض (Demo) مش بيانات حقيقية.
import type { Customer, Employee, FabricColor, Item, Supplier, Warehouse } from "./types";

export const BUSINESS = {
  name: "أبو سعدة للأقمشة",
  owner: "الحاج أبو سعدة",
  initials: "أس",
} as const;

export const WAREHOUSES: Warehouse[] = [
  { id: "kerdasa", name: "مخزن كرداسة", city: "كرداسة - الجيزة", manager: "محمود عبد الرحيم" },
  { id: "mahalla", name: "مخزن المحلة", city: "المحلة الكبرى - الغربية", manager: "سعيد الشناوي" },
];

export const COLORS: FabricColor[] = [
  { id: "black", name: "أسود", hex: "#1F1F22" },
  { id: "navy", name: "كحلي", hex: "#22335C" },
  { id: "beige", name: "بيج", hex: "#D9C4A3" },
  { id: "offwhite", name: "أوف وايت", hex: "#F1ECE0" },
  { id: "olive", name: "زيتي", hex: "#5E6B3A" },
  { id: "burgundy", name: "نبيتي", hex: "#6D1F2F" },
  { id: "grey", name: "رمادي", hex: "#8A8D93" },
  { id: "brown", name: "بني", hex: "#6B4A32" },
  { id: "mauve", name: "موف", hex: "#9C7FA6" },
  { id: "sky", name: "لبني", hex: "#9CC3E0" },
  { id: "camel", name: "جملي", hex: "#B9874E" },
  { id: "mint", name: "منت", hex: "#A8D5C2" },
  { id: "petrol", name: "بترولي", hex: "#1F5960" },
];

export const ITEMS: Item[] = [
  // الصيفي — بالمتر، والتوب حوالي 60 متر
  { id: "viscose", name: "فسكوز", season: "summer", unit: "meter", nominalRollSize: 60, salePrice: 85, baseCost: 76, colorIds: ["black", "navy", "beige", "offwhite", "olive", "burgundy", "sky", "mint"] },
  { id: "marasi", name: "مراسي", season: "summer", unit: "meter", nominalRollSize: 60, salePrice: 55, baseCost: 49, colorIds: ["black", "navy", "beige", "offwhite", "grey", "sky"] },
  { id: "marasi-ahram", name: "مراسي الأهرام", season: "summer", unit: "meter", nominalRollSize: 60, salePrice: 63, baseCost: 56, colorIds: ["black", "navy", "beige", "offwhite", "grey", "mint"] },
  { id: "mabosh", name: "مبوش", season: "summer", unit: "meter", nominalRollSize: 60, salePrice: 70, baseCost: 62, colorIds: ["black", "navy", "beige", "olive", "burgundy", "mauve", "sky"] },
  { id: "linen", name: "كتان", season: "summer", unit: "meter", nominalRollSize: 60, salePrice: 110, baseCost: 97, colorIds: ["offwhite", "beige", "olive", "camel", "sky", "grey"] },
  // الشتوي — أغلبه بالكيلو، والتوب حوالي 100 كيلو
  { id: "jacquard", name: "جاكار", season: "winter", unit: "kg", nominalRollSize: 100, salePrice: 285, baseCost: 255, colorIds: ["black", "navy", "burgundy", "camel", "grey", "petrol"] },
  { id: "velvet-haidi", name: "قطيفة هايدي", season: "winter", unit: "kg", nominalRollSize: 100, salePrice: 260, baseCost: 232, colorIds: ["black", "navy", "burgundy", "olive", "brown", "camel", "mauve", "petrol"] },
  { id: "freska", name: "فريسكا", season: "winter", unit: "kg", nominalRollSize: 100, salePrice: 240, baseCost: 214, colorIds: ["black", "navy", "grey", "brown", "camel", "burgundy"] },
];

export const SUPPLIERS: Supplier[] = [
  { id: "s1", name: "مصنع الدلتا للغزل والنسيج", city: "المحلة الكبرى" },
  { id: "s2", name: "شركة النيل للصباغة والتجهيز", city: "شبرا الخيمة" },
  { id: "s3", name: "مصانع العاشر للتريكو", city: "العاشر من رمضان" },
  { id: "s4", name: "مصنع الصفا للمنسوجات", city: "المحلة الكبرى" },
  { id: "s5", name: "شركة الأمل للقطيفة", city: "السادات" },
  { id: "s6", name: "مصنع الفجر للجاكار", city: "برج العرب" },
  { id: "s7", name: "شركة الوادي للكتان", city: "كفر الدوار" },
  { id: "s8", name: "مصنع المنصورة للفسكوز", city: "المنصورة" },
];

/** الموردين المناسبين لكل صنف */
export const ITEM_SUPPLIERS: Record<string, string[]> = {
  viscose: ["s8", "s2"],
  marasi: ["s1", "s4"],
  "marasi-ahram": ["s1", "s4"],
  mabosh: ["s2", "s4"],
  linen: ["s7", "s1"],
  jacquard: ["s6", "s3"],
  "velvet-haidi": ["s5", "s3"],
  freska: ["s3", "s6"],
};

export const CUSTOMERS: Customer[] = [
  // عملاء مخزن كرداسة — الجيزة والقاهرة
  { id: "c01", name: "مصنع النور للملابس الجاهزة", area: "شبرا الخيمة", phone: "0100 482 1173", homeWarehouseId: "kerdasa", creditLimit: 900_000 },
  { id: "c02", name: "ورشة الحاج سمير للتفصيل", area: "إمبابة", phone: "0112 903 5521", homeWarehouseId: "kerdasa", creditLimit: 300_000 },
  { id: "c03", name: "مصنع الأمانة للعبايات", area: "كرداسة", phone: "0122 716 4408", homeWarehouseId: "kerdasa", creditLimit: 650_000 },
  { id: "c04", name: "شركة الريان للملابس", area: "العمرانية", phone: "0109 554 2290", homeWarehouseId: "kerdasa", creditLimit: 800_000 },
  { id: "c05", name: "ورشة أولاد عبد الحميد", area: "بولاق الدكرور", phone: "0115 207 8834", homeWarehouseId: "kerdasa", creditLimit: 250_000 },
  { id: "c06", name: "مصنع الصفوة للجلابيات", area: "كرداسة", phone: "0127 338 1906", homeWarehouseId: "kerdasa", creditLimit: 700_000 },
  { id: "c07", name: "أتيليه ليالي", area: "المهندسين", phone: "0101 620 7745", homeWarehouseId: "kerdasa", creditLimit: 200_000 },
  { id: "c08", name: "مصنع البركة للملابس الحريمي", area: "أبو النمرس", phone: "0120 845 3317", homeWarehouseId: "kerdasa", creditLimit: 600_000 },
  { id: "c09", name: "شركة الفرسان للزي الموحد", area: "6 أكتوبر", phone: "0111 492 6058", homeWarehouseId: "kerdasa", creditLimit: 1_000_000 },
  { id: "c10", name: "ورشة مدام نجلاء", area: "ناهيا", phone: "0106 173 2289", homeWarehouseId: "kerdasa", creditLimit: 150_000 },
  { id: "c11", name: "مصنع الحرمين للإسدالات", area: "الوراق", phone: "0128 590 4471", homeWarehouseId: "kerdasa", creditLimit: 550_000 },
  { id: "c12", name: "معرض الشامي للأقمشة", area: "الموسكي", phone: "0102 366 9015", homeWarehouseId: "kerdasa", creditLimit: 750_000 },
  { id: "c13", name: "مصنع روز للبيجامات", area: "شبرا", phone: "0114 728 3360", homeWarehouseId: "kerdasa", creditLimit: 400_000 },
  { id: "c14", name: "ورشة أبو يوسف", area: "صفط اللبن", phone: "0103 981 5527", homeWarehouseId: "kerdasa", creditLimit: 180_000 },
  { id: "c15", name: "شركة مودرن ستايل", area: "العبور", phone: "0125 417 8892", homeWarehouseId: "kerdasa", creditLimit: 850_000 },
  // عملاء مخزن المحلة — الدلتا
  { id: "c16", name: "مصنع الشربيني للملابس", area: "المحلة الكبرى", phone: "0100 274 6631", homeWarehouseId: "mahalla", creditLimit: 900_000 },
  { id: "c17", name: "ورشة الحاج فتحي", area: "سمنود", phone: "0112 551 0948", homeWarehouseId: "mahalla", creditLimit: 250_000 },
  { id: "c18", name: "مصنع الهدى للعبايات", area: "طنطا", phone: "0122 903 7716", homeWarehouseId: "mahalla", creditLimit: 700_000 },
  { id: "c19", name: "شركة النجمة للملابس الجاهزة", area: "المنصورة", phone: "0109 338 2054", homeWarehouseId: "mahalla", creditLimit: 850_000 },
  { id: "c20", name: "ورشة أولاد الجندي", area: "زفتى", phone: "0115 690 4423", homeWarehouseId: "mahalla", creditLimit: 220_000 },
  { id: "c21", name: "مصنع السلام للجلابيات", area: "كفر الشيخ", phone: "0127 115 6689", homeWarehouseId: "mahalla", creditLimit: 600_000 },
  { id: "c22", name: "معرض الزيات للأقمشة", area: "المحلة الكبرى", phone: "0101 742 9930", homeWarehouseId: "mahalla", creditLimit: 800_000 },
  { id: "c23", name: "مصنع رحاب للحريمي", area: "شبين الكوم", phone: "0120 226 8814", homeWarehouseId: "mahalla", creditLimit: 500_000 },
  { id: "c24", name: "ورشة الأسطى حمدي", area: "قطور", phone: "0111 807 3352", homeWarehouseId: "mahalla", creditLimit: 160_000 },
  { id: "c25", name: "شركة الدلتا للزي المدرسي", area: "طنطا", phone: "0106 459 1178", homeWarehouseId: "mahalla", creditLimit: 950_000 },
  { id: "c26", name: "مصنع التقوى للإسدالات", area: "بسيون", phone: "0128 364 7705", homeWarehouseId: "mahalla", creditLimit: 450_000 },
  { id: "c27", name: "ورشة مدام سهير", area: "المحلة الكبرى", phone: "0102 913 4467", homeWarehouseId: "mahalla", creditLimit: 140_000 },
  { id: "c28", name: "مصنع الفردوس للملابس", area: "دمياط", phone: "0114 285 9031", homeWarehouseId: "mahalla", creditLimit: 700_000 },
  { id: "c29", name: "شركة الأصيل للمفروشات", area: "المنصورة", phone: "0103 670 2248", homeWarehouseId: "mahalla", creditLimit: 600_000 },
  { id: "c30", name: "معرض أولاد عيسى", area: "السنطة", phone: "0125 148 5596", homeWarehouseId: "mahalla", creditLimit: 350_000 },
];

export const DRIVERS = ["عم رمضان", "أحمد السواق", "عربية الحاج صابر", "شحن الدلتا"];

export const EXPENSE_NOTES = [
  "نقل وتحميل",
  "كهرباء ومياه",
  "شاي وضيافة",
  "صيانة رفوف",
  "أكياس وتغليف",
  "بنزين العربية",
];

/** العمالة: المرتبات الشهرية بتتقبض أول الشهر، وأسبوعيات العمال يوم الخميس */
export const EMPLOYEES: Employee[] = [
  // مخزن كرداسة
  { id: "e01", name: "محمود عبد الرحيم", jobTitle: "أمين مخزن", warehouseId: "kerdasa", payType: "monthly", wage: 13_000, hiredOn: "2019-03-01", phone: "0100 318 2240" },
  { id: "e02", name: "هاني فؤاد", jobTitle: "محاسب", warehouseId: "kerdasa", payType: "monthly", wage: 11_000, hiredOn: "2021-09-15", phone: "0112 447 9013" },
  { id: "e03", name: "كريم الصاوي", jobTitle: "مندوب مبيعات", warehouseId: "kerdasa", payType: "monthly", wage: 9_500, hiredOn: "2023-01-10", phone: "0122 905 6671" },
  { id: "e04", name: "عبده سيد", jobTitle: "عامل تحميل", warehouseId: "kerdasa", payType: "weekly", wage: 1_900, hiredOn: "2022-05-02", phone: "0109 223 4518" },
  { id: "e05", name: "مصطفى رجب", jobTitle: "عامل تحميل", warehouseId: "kerdasa", payType: "weekly", wage: 1_800, hiredOn: "2024-02-12", phone: "0115 660 3392" },
  { id: "e06", name: "حمادة شعبان", jobTitle: "عامل مخزن", warehouseId: "kerdasa", payType: "weekly", wage: 1_750, hiredOn: "2024-08-20", phone: "0127 118 0045" },
  { id: "e07", name: "رمضان عويس", jobTitle: "سواق", warehouseId: "kerdasa", payType: "weekly", wage: 2_300, hiredOn: "2020-11-01", phone: "0101 774 2269" },
  // مخزن المحلة
  { id: "e08", name: "سعيد الشناوي", jobTitle: "أمين مخزن", warehouseId: "mahalla", payType: "monthly", wage: 12_500, hiredOn: "2018-06-01", phone: "0100 552 7130" },
  { id: "e09", name: "إيمان الدسوقي", jobTitle: "محاسبة", warehouseId: "mahalla", payType: "monthly", wage: 10_000, hiredOn: "2022-03-01", phone: "0120 381 6624" },
  { id: "e10", name: "وليد البنا", jobTitle: "مندوب مبيعات", warehouseId: "mahalla", payType: "monthly", wage: 9_000, hiredOn: "2023-07-01", phone: "0111 209 8857" },
  { id: "e11", name: "السيد عطية", jobTitle: "عامل تحميل", warehouseId: "mahalla", payType: "weekly", wage: 1_800, hiredOn: "2021-04-11", phone: "0106 935 1180" },
  { id: "e12", name: "محمد الغرباوي", jobTitle: "عامل تحميل", warehouseId: "mahalla", payType: "weekly", wage: 1_800, hiredOn: "2023-10-01", phone: "0128 446 2093" },
  { id: "e13", name: "أشرف زكي", jobTitle: "عامل مخزن", warehouseId: "mahalla", payType: "weekly", wage: 1_700, hiredOn: "2025-01-05", phone: "0102 670 5514" },
  { id: "e14", name: "جمال أبو العلا", jobTitle: "عامل مخزن", warehouseId: "mahalla", payType: "weekly", wage: 1_700, hiredOn: "2025-06-14", phone: "0114 852 3376" },
  { id: "e15", name: "عم صابر", jobTitle: "سواق", warehouseId: "mahalla", payType: "weekly", wage: 2_200, hiredOn: "2019-09-01", phone: "0103 214 9968" },
];

export const ADVANCE_NOTES = ["ظرف عائلي", "مصاريف مدارس", "علاج", "إيجار", "جواز أخ", "مصاريف بيت"];

/** مستخدمين النظام — كل واحد بدوره ومخزنه */
export const USERS = [
  { id: "u1", name: "الحاج أبو سعدة", role: "owner" as const, title: "المالك", warehouse: null, phone: "0100 111 2233", lastSeen: "دلوقتي" },
  { id: "u2", name: "محمود عبد الرحيم", role: "storekeeper" as const, title: "أمين مخزن", warehouse: "kerdasa" as const, phone: "0100 318 2240", lastSeen: "من ساعة" },
  { id: "u3", name: "سعيد الشناوي", role: "storekeeper" as const, title: "أمين مخزن", warehouse: "mahalla" as const, phone: "0100 552 7130", lastSeen: "من 3 ساعات" },
  { id: "u4", name: "هاني فؤاد", role: "accountant" as const, title: "محاسب", warehouse: "kerdasa" as const, phone: "0112 447 9013", lastSeen: "امبارح" },
  { id: "u5", name: "إيمان الدسوقي", role: "accountant" as const, title: "محاسبة", warehouse: "mahalla" as const, phone: "0120 381 6624", lastSeen: "امبارح" },
];
