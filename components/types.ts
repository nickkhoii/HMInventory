export type Lookup = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  _count?: { items: number };
};
export type Item = {
  id: string;
  inventoryCode: string;
  name: string;
  description: string;
  categoryId: string;
  locationId: string;
  category: Lookup;
  location: Lookup;
  brand: string;
  model: string;
  serialNumber: string;
  unit: string;
  quantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  minimumStock: number;
  unitCost: string;
  totalValue: string;
  dateAcquired: string;
  supplier: string;
  condition: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type Transaction = {
  borrowTransactionId?: string | null;
  id: string;
  transactionNumber: string;
  itemId: string;
  item: Item;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  previousAvailable: number;
  newAvailable: number;
  transactionDate: string;
  createdAt: string;
  remarks: string;
  reason: string;
};
export type Incident = {
  returnItem?: {
    returnTransaction: {
      returnNumber: string;
      borrowTransaction: {
        id: string;
        transactionNumber: string;
        borrowerName: string;
      };
    };
  } | null;
  id: string;
  itemId: string;
  item: Item;
  quantity: number;
  dateReported: string;
  disposalDate: string;
  description: string;
  actionTaken: string;
  status: string;
  remarks: string;
  reason: string;
  method: string;
};
export type Options = {
  categories: Lookup[];
  locations: Lookup[];
  items: Pick<
    Item,
    | "id"
    | "name"
    | "inventoryCode"
    | "quantity"
    | "availableQuantity"
    | "condition"
  >[];
};
export type BorrowLine = {
  id: string;
  inventoryItemId: string;
  inventoryCode: string;
  itemName: string;
  unit: string;
  quantityBorrowed: number;
  quantityReturned: number;
  quantityCancelled: number;
  quantityOutstanding: number;
  conditionBeforeRelease: string;
  remarks: string;
};
export type BorrowRecord = {
  id: string;
  transactionNumber: string;
  borrowerName: string;
  borrowerType: string;
  borrowerIdNumber: string;
  department: string;
  program: string;
  yearSection: string;
  contactNumber: string;
  purpose: string;
  remarks: string;
  borrowedDate: string;
  expectedReturnDate: string;
  finalReturnDate: string | null;
  status: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string;
  daysOverdue: number;
  quantityBorrowed: number;
  quantityReturned: number;
  quantityOutstanding: number;
  items: BorrowLine[];
  returns?: {
    id: string;
    returnNumber: string;
    returnDate: string;
    remarks: string;
    createdAt: string;
    items: {
      id: string;
      borrowTransactionItemId: string;
      quantityReturned: number;
      returnCondition: string;
      damageDescription: string;
      actionRequired: string;
      remarks: string;
    }[];
  }[];
};
export type Report = {
  title: string;
  header: string;
  institution: string;
  laboratory: string;
  generatedAt: string;
  filters: string;
  columns: string[];
  rows: (string | number)[][];
  totalQuantity: number;
  totalValue: string | null;
};
