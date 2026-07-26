export type OwnerApprovalStatus = "Pending" | "Approved" | "Rejected" | "Suspended";

export interface ShopOwner {
  id: string;
  ownerName: string;
  shopName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: OwnerApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type Category = "Scooty" | "Bike" | "Car";
export type VehicleStatus = "Active" | "Inactive";

export interface Vehicle {
  id: string;
  ownerId: string;
  ownerName: string;
  shopName: string;
  ownerStatus: OwnerApprovalStatus;
  category: Category;
  name: string;
  brand: string;
  photoUrl: string | null;
  pricePerDay: number;
  stock: number;
  city: string;
  status: VehicleStatus;
  createdAt: string;
}

export interface ShopOwnerDetail extends ShopOwner {
  vehicles: {
    id: string;
    category: Category;
    name: string;
    brand: string;
    photoUrl: string | null;
    pricePerDay: number;
    stock: number;
    city: string;
    status: VehicleStatus;
  }[];
  totalBookings: number;
  totalEarnings: number;
}

export interface PlatformStats {
  totalOwners: number;
  pendingOwners: number;
  approvedOwners: number;
  rejectedOwners: number;
  suspendedOwners: number;
  totalVehicles: number;
  activeVehicles: number;
  totalBookings: number;
}

export interface PendingPayment {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleName: string;
  vehiclePhoto: string | null;
  city: string;
  quantity: number;
  totalPayableOnline: number;
  utrNumber: string | null;
  paymentScreenshotUrl: string | null;
  paymentSubmittedAt: string | null;
  createdAt: string;
}
