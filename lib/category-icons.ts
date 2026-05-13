import {
  UtensilsCrossed, Car, HeartPulse, Film, Shirt, Home, Laptop, GraduationCap,
  Plane, Gamepad2, Music, PawPrint, Sparkles, ShoppingCart, Beer, Dumbbell,
  Smartphone, Wallet, Coffee, Fuel, Bus, Pizza, Gift, Briefcase, Baby,
  Receipt, CreditCard, Wrench, Wifi, Zap, Tag, type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // food
  alimentación: UtensilsCrossed,
  alimentacion: UtensilsCrossed,
  comida: UtensilsCrossed,
  restaurantes: Pizza,
  restaurante: Pizza,
  café: Coffee,
  cafe: Coffee,
  bar: Beer,
  bebidas: Beer,
  // transport
  transporte: Car,
  auto: Car,
  nafta: Fuel,
  combustible: Fuel,
  colectivo: Bus,
  uber: Car,
  // home & utilities
  hogar: Home,
  casa: Home,
  expensas: Receipt,
  alquiler: Home,
  servicios: Zap,
  luz: Zap,
  internet: Wifi,
  // health
  salud: HeartPulse,
  farmacia: HeartPulse,
  médico: HeartPulse,
  medico: HeartPulse,
  // entertainment
  entretenimiento: Film,
  cine: Film,
  streaming: Film,
  netflix: Film,
  juegos: Gamepad2,
  música: Music,
  musica: Music,
  // shopping
  ropa: Shirt,
  compras: ShoppingCart,
  supermercado: ShoppingCart,
  super: ShoppingCart,
  regalos: Gift,
  // tech
  tecnología: Laptop,
  tecnologia: Laptop,
  apps: Smartphone,
  celular: Smartphone,
  // education
  educación: GraduationCap,
  educacion: GraduationCap,
  cursos: GraduationCap,
  libros: GraduationCap,
  // travel
  viajes: Plane,
  vacaciones: Plane,
  // misc
  mascotas: PawPrint,
  belleza: Sparkles,
  gym: Dumbbell,
  gimnasio: Dumbbell,
  trabajo: Briefcase,
  hijos: Baby,
  bancos: CreditCard,
  bancario: CreditCard,
  reparaciones: Wrench,
  ahorro: Wallet,
};

export function getCategoryIcon(name?: string): LucideIcon {
  if (!name) return Tag;
  const key = name.trim().toLowerCase();
  if (CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  const first = key.split(/\s+/)[0];
  return CATEGORY_ICON_MAP[first] ?? Tag;
}
