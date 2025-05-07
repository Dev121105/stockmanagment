// app/sales/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import { Button } from '../components/button'; // Adjust path as per your project structure
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path as per your project structure
import { toast } from 'sonner'; // Assuming you use Sonner for toasts
import { Trash2, Eye, Plus, X, Edit, Save } from 'lucide-react'; // Importing necessary icons, added Save


// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper function to parse DD-MM-YYYY string to Date
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
         const dayInt = parseInt(day, 10);
         const monthInt = parseInt(month, 10);
         const yearInt = parseInt(year, 10);
         // Month is 0-indexed in Date constructor
         if (dayInt >= 1 && dayInt <= 31 && monthInt >= 1 && monthInt <= 12 && yearInt >= 1900 && yearInt <= 2100) {
             return new Date(yearInt, monthInt - 1, dayInt);
         }
     }
    return null; // Default to null if parsing fails
}

 // Helper function to parse MM-YY date strings into a Date object
 // Returns a Date object (set to the 1st of the month) or null if invalid or empty string
 function parseMonthYearDate(dateString) {
     if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
         return null; // Return null for empty or invalid string
     }
     const parts = dateString.split('-');
     if (parts.length !== 2) {
         return null; // Must have exactly two parts (MM and YY)
     }
     const [month, year] = parts;
     const monthInt = parseInt(month, 10);
     const yearInt = parseInt(year, 10);

     if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
         if (monthInt >= 1 && monthInt <= 12 && yearInt >= 0 && yearInt <= 99) {
             const fullYear = 2000 + yearInt; // Simple approach: assume 20xx
             return new Date(fullYear, monthInt - 1, 1); // Use day 1 for consistency
         }
     }
     return null; // Return null for invalid format or values
 }


const SalesPage = () => {
    // State for the main form (used for both new entry and editing)
    const [billNumber, setBillNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [date, setDate] = useState(formatDate(new Date()));
    const [salesItems, setSalesItems] = useState([{ product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]);


    // State for managing bills and products data
    const [salesBills, setSalesBills] = useState([]);
    const [products, setProducts] = useState([]);
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [customers, setCustomers] = useState([]);

    // State for search and filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredSalesBills, setFilteredSalesBills] = useState([]);

    // State for viewing bill details in a dialog
    const [selectedBillDetails, setSelectedBillDetails] = useState(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

    // State for editing bill details in a dialog
    const [editingBill, setEditingBill] = useState(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // NEW STATE: To store the last saved bill number
    const [lastSavedBillNumber, setLastSavedBillNumber] = useState(null);


    const router = useRouter();

    // --- Helper functions moved inside the component ---

    // Helper function to load products from localStorage and ensure data types
    const loadProductsFromLocalStorage = useCallback(() => {
      console.log("SalesPage: Attempting to load products from localStorage...");
      try {
        const storedProducts = localStorage.getItem('products');
        console.log("SalesPage: localStorage 'products' raw data loaded.");
        const products = storedProducts ? JSON.parse(storedProducts) : [];
        console.log(
          "SalesPage: Successfully parsed products. Count:",
          products.length
        );
        const processedProducts = products
          .map((p) => {
            try {
              return {
                ...p,
                quantity: Number(p.quantity) || 0, // Stock quantity (individual items)
                mrp: Number(p.mrp) || 0, // Selling price (per item?)
                itemsPerPack: Number(p.itemsPerPack) || 1, // Items per pack
                minStock: Number(p.minStock) || 0,
                maxStock: Number(p.maxStock) || 0,
                discount: Number(p.discount) || 0,
                name: p.name || '',
                unit: p.unit || '',
                category: p.category || '',
                company: p.company || '',
                id: p.id,
                batch: p.batch || '',
                expiry: p.expiry || '',
              };
            } catch (mapErr) {
              console.error(
                "SalesPage: Error processing product item during map:",
                p,
                mapErr
              );
              toast.error(`Error processing product data for item with ID: ${p?.id || 'unknown'}.`);
              return null;
            }
          })
          .filter((p) => p !== null);

        console.log(
          "SalesPage: Finished processing products. Valid product count:",
          processedProducts.length
        );
        setProducts(processedProducts); // Set state here
        return processedProducts; // Return data for initial load
      } catch (err) {
        console.error(
          "SalesPage: Error loading or parsing products from localStorage:",
          err
        );
        toast.error("Error loading product master data.");
        setProducts([]); // Set state here
        return []; // Return empty array on error
      }
    }, [setProducts]); // Added setProducts to useCallback dependencies

    // Helper function to load purchase bills from localStorage
    const loadPurchaseBillsFromLocalStorage = useCallback(() => {
      console.log(
        "SalesPage: Attempting to load purchase bills from localStorage..."
      );
      try {
        const storedBills = localStorage.getItem('purchaseBills');
        const bills = storedBills ? JSON.parse(storedBills) : [];
        console.log(
          "SalesPage: Successfully parsed purchase bills. Count:",
          bills.length
        );
        const processedBills = bills.map((bill) => {
            try {
                 return {
                    ...bill,
                    date: bill.date || '',
                    items: bill.items.map((item) => ({
                      ...item,
                      product: item.product || '',
                      batch: item.batch || '',
                      expiry: item.expiry || '',
                      quantity: Number(item.quantity) || 0, // Quantity purchased in this line
                      packsPurchased: Number(item.packsPurchased) || 0,
                      itemsPerPack: Number(item.itemsPerPack) || 1,
                      ptr: Number(item.ptr) || 0,
                      unit: item.unit || '',
                      category: item.category || '',
                      company: item.company || '',
                      discount: Number(item.discount) || 0,
                      taxRate: Number(item.taxRate) || 0,
                    })),
                    totalAmount: Number(bill.totalAmount) || 0,
                };
            } catch (mapErr) {
                 console.error("SalesPage: Error processing purchase bill item during map:", bill, mapErr);
                 toast.error(`Error processing purchase bill data for bill number: ${bill?.billNumber || 'unknown'}.`);
                 return null;
            }
        }).filter(bill => bill !== null);

        processedBills.sort((a, b) => {
          const dateA = parseDate(a.date);
          const dateB = parseDate(b.date);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateB - dateA;
        });
        setPurchaseBills(processedBills); // Set state here
        return processedBills; // Return data for initial load
      } catch (err) {
        console.error("SalesPage: Error loading or parsing purchase bills:", err);
        toast.error("Error loading purchase bill data for batch info.");
        setPurchaseBills([]); // Set state here
        return []; // Return empty array on error
      }
    }, [setPurchaseBills]); // Added setPurchaseBills to useCallback dependencies


    // Helper function to load sales bills from localStorage
    const loadSalesBillsFromLocalStorage = useCallback(() => {
      console.log("SalesPage: Attempting to load sales bills from localStorage...");
      try {
        const storedBills = localStorage.getItem('salesBills');
        const bills = storedBills ? JSON.parse(storedBills) : [];
        console.log(
          "SalesPage: Successfully parsed sales bills. Count:",
          bills.length
        );
        const processedBills = bills.map((bill) => {
            try {
                return {
                    ...bill,
                    date: bill.date ? (formatDate(parseDate(bill.date)) || bill.date || '') : '',
                    totalAmount: Number(bill.totalAmount) || 0,
                    customerName: bill.customerName || '',
                    items: bill.items.map((item) => ({
                        ...item,
                        quantitySold: Number(item.quantitySold) || 0,
                        pricePerItem: Number(item.pricePerItem) || 0,
                        discount: Number(item.discount) || 0,
                        totalItemAmount: Number(item.totalItemAmount) || 0,
                        productMrp: Number(item.productMrp) || 0,
                        productItemsPerPack: Number(item.productItemsPerPack) || 1,
                        product: item.product || '',
                        batch: item.batch || '',
                        expiry: item.expiry || '',
                        unit: item.unit || '', category: item.category || '', company: item.company || '',
                    })),
                };
            } catch (mapErr) {
                 console.error("SalesPage: Error processing sales bill item during map:", bill, mapErr);
                 toast.error(`Error processing sales bill data for bill number: ${bill?.billNumber || 'unknown'}.`);
                 return null;
            }
        }).filter(bill => bill !== null);

        processedBills.sort((a, b) => {
          const dateA = parseDate(a.date);
          const dateB = parseDate(b.date);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateB - dateA;
        });
        setSalesBills(processedBills); // Set state here
        setFilteredSalesBills(processedBills); // Also update filtered list
        return processedBills; // Return data for initial load
      } catch (err) {
        console.error("SalesPage: Error loading or parsing sales bills:", err);
        toast.error("Error loading sales bill data.");
        setSalesBills([]); // Set state here
        setFilteredSalesBills([]); // Also update filtered list
        return []; // Return empty array on error
      }
    }, [setSalesBills, setFilteredSalesBills]); // Added state setters to useCallback dependencies

     // Helper function to load customers from localStorage for suggestions
     const loadCustomersFromLocalStorage = useCallback(() => {
          console.log("SalesPage useEffect: Loading customers from localStorage...");
         const storedCustomers = localStorage.getItem('customers');
         if (storedCustomers) {
             try {
                 const parsedCustomers = JSON.parse(storedCustomers);
                 setCustomers(parsedCustomers); // Set state here
                  console.log("SalesPage useEffect: Customers loaded and parsed:", parsedCustomers.length);
                  return parsedCustomers; // Return loaded customers
             } catch (error) {
                 console.error("SalesPage useEffect: Error parsing customers from localStorage:", error);
                 setCustomers([]); // Set state here
                 toast.error("Error loading customer data.");
                 return []; // Return empty array on error
             }
         } else {
              console.log("SalesPage useEffect: No customers found in localStorage.");
              setCustomers([]); // Set state here
              return []; // Return empty array if none found
         }
     }, [setCustomers]); // Added setCustomers to useCallback dependencies

     // Helper function to load the last bill number from localStorage
     const loadLastBillNumber = useCallback(() => {
         console.log("SalesPage: Loading last bill number from localStorage...");
         try {
             const lastBillNumber = localStorage.getItem('lastSalesBillNumber');
             console.log("SalesPage: Last bill number loaded:", lastBillNumber);
             // Return null if not found, otherwise return the value
             return lastBillNumber || null;
         } catch (error) {
             console.error("SalesPage: Error loading last bill number from localStorage:", error);
             toast.error("Error loading last bill number.");
             return null; // Return null on error
         }
     }, []); // No dependencies as it doesn't use state/props

     // Helper function to save the last bill number to localStorage
     const saveLastBillNumber = useCallback((billNumber) => {
         console.log("SalesPage: Saving last bill number to localStorage:", billNumber);
         try {
             localStorage.setItem('lastSalesBillNumber', billNumber);
             console.log("SalesPage: Last bill number saved successfully.");
         } catch (error) {
             console.error("SalesPage: Error saving last bill number to localStorage:", error);
             toast.error("Error saving last bill number.");
         }
     }, []); // No dependencies as it doesn't use state/props

    // --- Data Loading Effect ---
    useEffect(() => {
        console.log("SalesPage useEffect: Component mounted. Initiating data loads.");

        // Initial load of all necessary data using the useCallback versions
        loadProductsFromLocalStorage();
        loadPurchaseBillsFromLocalStorage();
        loadSalesBillsFromLocalStorage();
        loadCustomersFromLocalStorage();
        const initialLastBillNumber = loadLastBillNumber(); // Load last bill number
        setLastSavedBillNumber(initialLastBillNumber); // Set the last saved bill number state

        // Set up event listener for product updates
        const handleProductsUpdated = () => {
             console.log("SalesPage: 'productsUpdated' event received. Reloading products and purchase bills.");
            loadProductsFromLocalStorage(); // Reload products
            loadPurchaseBillsFromLocalStorage(); // Reload purchase data
             // Note: Sales bills and customers are not typically updated by this event, so no need to reload them here.
        };

        console.log("SalesPage useEffect: Adding 'productsUpdated' event listener.");
        window.addEventListener('productsUpdated', handleProductsUpdated);

        // Clean up event listener on component unmount
        return () => {
             console.log("SalesPage useEffect: Component unmounting. Removing event listener.");
            window.removeEventListener('productsUpdated', handleProductsUpdated);
        };

    }, [loadProductsFromLocalStorage, loadPurchaseBillsFromLocalStorage, loadSalesBillsFromLocalStorage, loadCustomersFromLocalStorage, loadLastBillNumber]); // Added useCallback dependencies


    // --- EFFECT: Auto-generate Bill Number when lastSavedBillNumber changes and not editing ---
    useEffect(() => {
        console.log("SalesPage useEffect: lastSavedBillNumber or editingBill changed.");
        // Only auto-generate if we are NOT currently editing a bill AND the bill number field is currently empty
        // This prevents overwriting a manually entered bill number or a bill number loaded for editing
        if (!editingBill && billNumber === '') {
            console.log("SalesPage useEffect: Not editing and bill number is empty, attempting to auto-generate.");
            // If lastSavedBillNumber is available, try to increment it
            if (lastSavedBillNumber) {
                // Simple numeric increment assumption (e.g., 1001 -> 1002)
                // If your bill numbers are more complex (e.g., INV-2023-001),
                // you'll need more sophisticated parsing/increment logic here.
                try {
                    const numericPart = parseInt(lastSavedBillNumber, 10);
                    if (!isNaN(numericPart)) {
                        const nextNumber = numericPart + 1;
                        // Assuming bill numbers are just numbers, convert back to string
                        setBillNumber(String(nextNumber));
                        console.log("SalesPage useEffect: Auto-generated next bill number:", nextNumber);
                    } else {
                         // If the last bill number wasn't purely numeric, maybe start from a default or require manual entry
                         console.warn("SalesPage useEffect: Last bill number is not purely numeric. Cannot auto-increment. Requires manual entry.");
                         setBillNumber(''); // Clear if cannot auto-increment
                         toast.warning("Last bill number is not numeric. Please enter the bill number manually.");
                    }
                } catch (parseError) {
                     console.error("SalesPage useEffect: Error parsing last bill number for auto-increment:", parseError);
                     setBillNumber(''); // Clear on error
                     toast.error("Error auto-generating bill number. Please enter manually.");
                }
            } else {
                // If no lastSavedBillNumber, start from a default (e.g., 1001)
                 console.log("SalesPage useEffect: No last bill number found. Starting from default '1001'.");
                setBillNumber('1001'); // Default starting bill number
            }
        } else {
             console.log("SalesPage useEffect: Currently editing or bill number is not empty, not auto-generating bill number.");
             // When editing, the bill number is populated by handleEditBill
        }
    }, [lastSavedBillNumber, editingBill, billNumber]); // Added billNumber to dependencies


    // --- Stock Calculation Logic (Memoized) ---
    const batchStock = useMemo(() => {
        console.log("SalesPage useMemo: Calculating batch stock...");
        const stockMap = new Map();

        purchaseBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && item.batch && item.expiry) {
                    const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                    const quantity = Number(item.quantity) || 0;
                    stockMap.set(key, (stockMap.get(key) || 0) + quantity);
                }
            });
        });

        salesBills.forEach(bill => {
            bill.items.forEach(item => {
                if (item.product && item.batch && item.expiry) {
                    const key = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
                    const quantitySold = Number(item.quantitySold) || 0;
                    stockMap.set(key, Math.max(0, (stockMap.get(key) || 0) - quantitySold));
                }
            });
        });

        console.log("SalesPage useMemo: Batch stock calculated.", Object.fromEntries(stockMap));
        return stockMap;
    }, [purchaseBills, salesBills]);


    // Update filtered sales bills when searchQuery or salesBills change
    useEffect(() => {
         console.log("SalesPage filter useEffect: Search query or salesBills updated. Filtering bills.");
        const query = searchQuery.toLowerCase();
        const filtered = salesBills.filter(bill =>
            bill.billNumber.toLowerCase().includes(query) ||
            bill.customerName.toLowerCase().includes(query) ||
            bill.date.includes(query)
        );
        setFilteredSalesBills(filtered);
         console.log("SalesPage filter useEffect: Filtered sales bills count:", filtered.length);
        // Reset selected bill details and editing bill when search query changes
        setSelectedBillDetails(null);
        setEditingBill(null);
        setIsViewDialogOpen(false);
        setIsEditDialogOpen(false);
    }, [searchQuery, salesBills]);

    // Handle date change (still in DD-MM-YYYY format for the main bill date input)
    const handleDateChange = (e) => {
        setDate(e.target.value);
    };

    // Handle input change for sales items (used by both new entry and edit form)
    const handleItemChange = (index, field, value) => {
        const updatedItems = [...salesItems];
        updatedItems[index][field] = value;

        // --- Logic for Product Selection ---
        if (field === 'product') {
             updatedItems[index]['batch'] = '';
             updatedItems[index]['expiry'] = '';
             updatedItems[index]['quantitySold'] = '';
             updatedItems[index]['pricePerItem'] = '';
             updatedItems[index]['discount'] = '';
             updatedItems[index]['unit'] = '';
             updatedItems[index]['category'] = '';
             updatedItems[index]['company'] = '';
             updatedItems[index]['totalItemAmount'] = 0;
             updatedItems[index]['productMrp'] = '';
             updatedItems[index]['productItemsPerPack'] = '';


             const availableBatches = [];
             const seenBatches = new Set();

             if (value.trim() !== '') {
                 const productNameLower = value.trim().toLowerCase();
                 purchaseBills.forEach(purchaseBill => {
                     purchaseBill.items.forEach(purchaseItem => {
                         if (purchaseItem.product.toLowerCase() === productNameLower && purchaseItem.batch && purchaseItem.expiry) {
                             const batchIdentifier = `${purchaseItem.batch.trim().toLowerCase()}-${purchaseItem.expiry.trim().toLowerCase()}`;

                             if (!seenBatches.has(batchIdentifier)) {
                                  availableBatches.push({
                                      display: `Batch: ${purchaseItem.batch.trim()} - Exp: ${purchaseItem.expiry.trim()}`,
                                      batch: purchaseItem.batch.trim(),
                                      expiry: purchaseItem.expiry.trim(),
                                      ptr: Number(purchaseItem.ptr) || 0,
                                      itemsPerPack: Number(purchaseItem.itemsPerPack) || 1,
                                      unit: purchaseItem.unit || '',
                                      category: purchaseItem.category || '',
                                      company: purchaseItem.company || '',
                                  });
                                  seenBatches.add(batchIdentifier);
                             }
                         }
                     });
                 });
                  console.log(`Item ${index}: Found ${availableBatches.length} unique batch/expiry combinations for product "${value.trim()}".`);
             }
             updatedItems[index]['availableBatches'] = availableBatches;

              if (value.trim() !== '') {
                  const selectedProductMaster = products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
                  if (selectedProductMaster) {
                      updatedItems[index]['unit'] = selectedProductMaster.unit || '';
                      updatedItems[index]['category'] = selectedProductMaster.category || '';
                      updatedItems[index]['company'] = selectedProductMaster.company || '';
                      updatedItems[index]['discount'] = String(selectedProductMaster.discount || 0) || '';

                       const mrp = Number(selectedProductMaster.mrp) || 0;
                       const itemsPerPack = Number(selectedProductMaster.itemsPerPack) || 1;
                       updatedItems[index]['productMrp'] = String(mrp);
                       updatedItems[index]['productItemsPerPack'] = String(itemsPerPack);

                       const calculatedPricePerItem = (itemsPerPack > 0) ? (mrp / itemsPerPack) : mrp;
                       updatedItems[index]['pricePerItem'] = calculatedPricePerItem.toFixed(2);
                       console.log(`Item ${index}: Product "${value.trim()}" selected. Setting Price/Item to (MRP / ItemsPerPack) = (${mrp} / ${itemsPerPack}) = ${updatedItems[index]['pricePerItem']}`);


                  } else {
                       updatedItems[index]['productMrp'] = '';
                       updatedItems[index]['productItemsPerPack'] = '';
                       updatedItems[index]['pricePerItem'] = '';
                       console.warn(`Item ${index}: Product "${value.trim()}" not found in Product Master. MRP, Items/Pack, and Price/Item cleared.`);
                  }
              }


        }

         if (field === 'batch') {
             const selectedBatchDetail = updatedItems[index]['availableBatches'].find(batch => batch.display.trim().toLowerCase() === value.trim().toLowerCase());

             if (selectedBatchDetail) {
                 console.log(`Item ${index}: Batch "${value.trim()}" selected from suggestions. Auto-filling Expiry and basic info.`);
                 updatedItems[index]['batch'] = selectedBatchDetail.batch;
                 updatedItems[index]['expiry'] = selectedBatchDetail.expiry;

                 updatedItems[index]['unit'] = selectedBatchDetail.unit || updatedItems[index]['unit'] || '';
                 updatedItems[index]['category'] = selectedBatchDetail.category || updatedItems[index]['category'] || '';
                 updatedItems[index]['company'] = selectedBatchDetail.company || updatedItems[index]['company'] || '';

                 console.log(`Item ${index}: Auto-filled Expiry: ${selectedBatchDetail.expiry}. Price/Item remains based on Product MRP.`);

                 updatedItems[index]['quantitySold'] = '';
                  updatedItems[index]['totalItemAmount'] = 0;

             } else {
                 console.log(`Item ${index}: Selected batch display "${value.trim()}" not found in available batches for exact match.`);
                 updatedItems[index]['batch'] = value;
                 updatedItems[index]['expiry'] = '';
                 updatedItems[index]['unit'] = updatedItems[index]['unit'] || '';
                 updatedItems[index]['category'] = updatedItems[index]['category'] || '';
                 updatedItems[index]['company'] = updatedItems[index]['company'] || '';

                 updatedItems[index]['totalItemAmount'] = 0;
                 updatedItems[index]['quantitySold'] = '';

                 if (value.trim() !== '') {
                      toast.warning(`Entered batch "${value.trim()}" doesn't match known batches for this product. Expiry not auto-filled.`);
                 }
             }
         }

         if (field === 'expiry') {
              console.log(`Item ${index}: Manual expiry change to "${value}".`);
         }


         if (['quantitySold', 'pricePerItem', 'discount'].includes(field)) {
             const quantity = Number(updatedItems[index]['quantitySold']) || 0;
             const price = Number(updatedItems[index]['pricePerItem']) || 0;
             const discount = Number(updatedItems[index]['discount']) || 0;

             if (quantity >= 0 && price >= 0 && discount >= 0 && discount <= 100) {
                 const priceAfterDiscountPerItem = price * (1 - (discount / 100));
                 updatedItems[index]['totalItemAmount'] = quantity * priceAfterDiscountPerItem;
                  console.log(`Item ${index}: Calculated item total ${updatedItems[index]['totalItemAmount'].toFixed(2)} (qty: ${quantity}, price/item: ${price}, discount: ${discount}%)`);
             } else {
                 updatedItems[index]['totalItemAmount'] = 0;
                  console.log(`Item ${index}: Invalid inputs for total calculation. Total set to 0.`);
             }
         }


        setSalesItems(updatedItems);
    };

    // Add new sales item row
    const addItem = () => {
         console.log("Adding new item row.");
        setSalesItems([...salesItems, { product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]);
    };

    // Remove sales item row
    const removeItem = (index) => {
         console.log(`Removing item row at index ${index}.`);
        const updatedItems = [...salesItems];
        updatedItems.splice(index, 1);
        setSalesItems(updatedItems);
    };

    // Calculate grand total for the entire sale
    const calculateGrandTotal = () => {
         console.log("Calculating grand total...");
        const total = salesItems.reduce((sum, item) => sum + (Number(item.totalItemAmount) || 0), 0);
         console.log("Grand total calculated:", total.toFixed(2));
        return total;
    };

    // Handle search query change for bills list
    const handleSearchChange = (e) => {
         console.log("Search query changed:", e.target.value);
        setSearchQuery(e.target.value);
    };

    // Function to validate form data before saving
    const validateFormData = () => {
        console.log("Log S.1: Validating sales form data...");

        if (!billNumber.trim()) {
            toast.error('Please enter Bill/Invoice Number.');
            console.log("Log S.2: Validation failed: Bill number empty.");
            return false;
        }
        if (!customerName.trim()) {
            toast.error('Please enter customer name.');
            console.log("Log S.3: Validation failed: Customer name empty.");
            return false;
        }
         if (!date.trim() || !/^\d{2}-\d{2}-\d{4}$/.test(date.trim())) {
              toast.error('Invalid Bill Date format. Please enter date in DD-MM-YYYY.');
              console.log("Log S.4: Validation failed: Invalid date format.");
              return false;
         }

        if (salesItems.length === 0) {
            toast.error('Please add at least one item to the sale.');
            console.log("Log S.5: Validation failed: No sales items.");
            return false;
        }

        for (const item of salesItems) {
             console.log("Log S.6: Validating item:", item);
            if (!item.product.trim()) {
                 toast.error(`Product name is required for all items.`);
                 console.log(`Log S.7: Validation failed: Missing product name for item:`, item);
                return false;
            }
             if (!item.batch.trim()) {
                 toast.error(`Batch No is required for product "${item.product}". Please select a batch or enter manually.`);
                 console.log(`Log S.8: Validation failed: Missing batch for item "${item.product}":`, item);
                 return false;
             }
             if (!item.expiry.trim()) {
                 toast.error(`Expiry Date is required for product "${item.product}". Please select a batch or enter manually.`);
                 console.log(`Log S.9: Validation failed: Missing expiry for item "${item.product}":`, item.expiry);
                 return false;
             }
             if (item.expiry.trim() && !/^\d{2}-\d{2}$/.test(item.expiry.trim())) {
                toast.error(`Invalid "Expiry Date" format for product "${item.product}". Please use MM-YY.`);
                 console.log(`Log S.9.1: Validation failed: Invalid expiry format for item "${item.product}":`, item.expiry);
                return false;
            }
             const expiryDateObj = parseMonthYearDate(item.expiry);
              if (expiryDateObj) {
                 const today = new Date();
                  const nextMonthAfterExpiry = new Date(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, 1);
                 if (nextMonthAfterExpiry < today) {
                      console.log(`Log S.11: Warning: Expity date in past for item "${item.product}" (Batch: ${item.batch}).`);
                 }
              }

             const quantitySold = Number(item.quantitySold);
             const pricePerItem = Number(item.pricePerItem);
             const discount = Number(item.discount);

             if (item.quantitySold.trim() === '' || isNaN(quantitySold) || quantitySold <= 0) {
                 toast.error(`Invalid "Quantity Sold" for product "${item.product}". Please enter a positive number.`);
                 console.log(`Log S.12: Validation failed: Invalid Quantity Sold for item "${item.product}":`, item.quantitySold);
                 return false;
             }

             if (item.pricePerItem.trim() === '' || isNaN(pricePerItem) || pricePerItem < 0) {
                 toast.error(`Invalid "Price per Item" for product "${item.product}". Please ensure a valid product is selected.`);
                 console.log(`Log S.13: Validation failed: Invalid Price per Item for item "${item.product}":`, item.pricePerItem);
                 return false;
             }

             if (item.discount.trim() !== '' && (isNaN(discount) || discount < 0 || discount > 100)) {
                  toast.error(`Invalid "Discount (%)" for product "${item.product}". Please enter a number between 0 and 100.`);
                  console.log(`Log S.14: Validation failed: Invalid discount for item "${item.product}":`, item.discount);
                  return false;
             }

             if (!item.unit.trim()) {
                 toast.error(`Unit is required for product "${item.product}".`);
                 console.log(`Log S.16: Validation failed: Missing unit for item "${item.product}"`);
                 return false;
             }
             if (!item.category.trim()) {
                 toast.error(`Category is required for product "${item.product}".`);
                 console.log(`Log S.17: Validation failed: Missing category for item "${item.product}"`);
                 return false;
             }
             if (!item.company.trim()) {
                 toast.error(`Company/Manufacturer is required for product "${item.product}".`);
                 console.log(`Log S.18: Validation failed: Missing company for item "${item.product}"`);
                 return false;
             }

            // --- Stock Availability Check (Batch-Specific) ---
            console.log(`Log S.19: Performing batch-specific stock check for "${item.product}" (Batch: ${item.batch}, Expiry: ${item.expiry}).`);
            const batchKey = `${item.product.trim().toLowerCase()}_${item.batch.trim().toLowerCase()}_${item.expiry.trim().toLowerCase()}`;
            const availableBatchStock = batchStock.get(batchKey) || 0; // Get stock for this specific batch/expiry

            // If editing, we need to consider the quantity from the original bill for this item
            let quantitySoldInOriginalBill = 0;
            if (editingBill) {
                const originalItem = editingBill.items.find(
                    original => original.product?.trim().toLowerCase() === item.product?.trim().toLowerCase() &&
                              original.batch?.trim().toLowerCase() === item.batch?.trim().toLowerCase() &&
                              original.expiry?.trim().toLowerCase() === item.expiry?.trim().toLowerCase()
                );
                quantitySoldInOriginalBill = Number(originalItem?.quantitySold) || 0;
                 console.log(`Log S.19.1: Editing mode detected. Original quantity sold for this item/batch: ${quantitySoldInOriginalBill}`);
            }

             // Calculate the *net* available stock for this batch considering the original sale (if editing)
             // Net available = Current Batch Stock + Quantity sold in original bill (if editing)
             const netAvailableStock = availableBatchStock + quantitySoldInOriginalBill;
             console.log(`Log S.19.2: Available batch stock: ${availableBatchStock}, Original sold in this bill: ${quantitySoldInOriginalBill}, Net available for this transaction: ${netAvailableStock}`);


            if (quantitySold > netAvailableStock) {
                toast.error(`Insufficient stock for "${item.product}" (Batch: ${item.batch}, Exp: ${item.expiry}). Available: ${availableBatchStock} items.`); // More specific message
                 console.log(`Log S.20: Validation failed: Insufficient batch stock for "${item.product}" (Batch: ${item.batch}, Exp: ${item.expiry}). Available: ${availableBatchStock}, Attempted: ${quantitySold}`);
                return false;
            }
            console.log(`Log S.21: Batch stock check passed for "${item.product}" (Batch: ${item.batch}, Exp: ${item.expiry}).`);

        }
        console.log("Log S.22: Validation successful. All items valid.");
        return true; // Validation passed
    };


    // Function to handle saving a new sales bill or updating an existing one
    const handleSaveOrUpdateBill = () => {
        console.log("Log S.23: handleSaveOrUpdateBill called.");
        console.log("Log S.24: Current editingBill state:", editingBill);

        if (!validateFormData()) {
            console.log("Log S.25: Validation failed, stopping save/update.");
            return;
        }

        console.log("Log S.26: Validation successful. Proceeding to save/update.");

        const salesItemsToSave = salesItems.map(item => ({
            ...item,
             quantitySold: Number(item.quantitySold) || 0,
             pricePerItem: Number(item.pricePerItem) || 0,
             discount: Number(item.discount) || 0,
             totalItemAmount: Number(item.totalItemAmount) || 0,
             productMrp: Number(item.productMrp) || 0,
             productItemsPerPack: Number(item.productItemsPerPack) || 1,
             product: item.product.trim(),
             batch: item.batch.trim(),
             expiry: item.expiry.trim(),
             unit: item.unit.trim(),
             category: item.category.trim(),
             company: item.company.trim(),
             availableBatches: undefined, // Do NOT save transient UI state
        }));

        const currentBillData = {
             id: editingBill ? editingBill.id : Date.now() + Math.random(),
            billNumber: billNumber.trim(),
            customerName: customerName.trim(),
            date: date.trim(),
            items: salesItemsToSave,
            totalAmount: calculateGrandTotal(),
        };

        console.log("Log S.27: Prepared sales bill data:", currentBillData);

        // --- Update Stock (Products) - Now based on Batch Stock changes ---
        const stockChanges = new Map(); // Key: "productName_batch_expiry", Value: net change in quantity

        // Calculate changes from original bill (if editing)
        if (editingBill) {
            console.log("Log S.28: Editing mode: Calculating stock changes from original bill.");
            editingBill.items.forEach(originalItem => {
                if (originalItem.product && originalItem.batch && originalItem.expiry) {
                    const key = `${originalItem.product.trim().toLowerCase()}_${originalItem.batch.trim().toLowerCase()}_${originalItem.expiry.trim().toLowerCase()}`;
                    const quantitySold = Number(originalItem.quantitySold) || 0;
                    stockChanges.set(key, (stockChanges.get(key) || 0) + quantitySold); // Add back original quantity
                    console.log(`Log S.28.1: Original item change: Added back ${quantitySold} for ${key}. Current change: ${stockChanges.get(key)}`);
                }
            });
        }

        // Calculate changes from the new/edited bill data
        console.log("Log S.29: Calculating stock changes from new/edited bill data.");
        salesItemsToSave.forEach(newItem => {
             if (newItem.product && newItem.batch && newItem.expiry) {
                 const key = `${newItem.product.trim().toLowerCase()}_${newItem.batch.trim().toLowerCase()}_${newItem.expiry.trim().toLowerCase()}`;
                 const quantitySold = Number(newItem.quantitySold) || 0;
                 stockChanges.set(key, (stockChanges.get(key) || 0) - quantitySold); // Subtract new quantity
                 console.log(`Log S.29.1: New/Edited item change: Subtracted ${quantitySold} for ${key}. Current change: ${stockChanges.get(key)}`);
             }
        });

        console.log("Log S.30: Calculated total stock changes per batch:", Object.fromEntries(stockChanges));

        const updatedProducts = products.map(p => ({ ...p })); // Clone Product Master list for updating
        console.log("Log S.31: Cloned products for stock update. Initial count:", updatedProducts.length);
        let stockUpdateSuccessful = true;
        let stockUpdateErrors = [];

        // Apply stock changes to the Product Master quantities
        stockChanges.forEach((change, key) => {
            const [productNameLower] = key.split("_");
            const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === productNameLower);

            if (productToUpdate) {
                productToUpdate.quantity += change;
                console.log(`Log S.32: Applied stock change (${change}) to product "${productToUpdate.name}". New quantity: ${productToUpdate.quantity}`);
                 if (productToUpdate.quantity < 0) {
                      console.warn(`Log S.32.1: Warning: Product "${productToUpdate.name}" quantity went below zero after change (${change}). Setting to 0.`);
                      productToUpdate.quantity = 0;
                 }
            } else {
                 console.warn(`Log S.33: Warning: Product with key "${key}" not found in current Product Master list. Stock update skipped for this batch.`);
                 stockUpdateErrors.push(`Stock for a batch of "${key.split('_')[0]}" could not be updated (product not found in master).`);
                 stockUpdateSuccessful = false;
            }
        });

        console.log("Log S.34: Finished applying stock changes to products.");


         // --- Save Updated Products to Local Storage and State ---
         console.log("Log S.35: Attempting to save updated products to localStorage.");
         try {
             localStorage.setItem('products', JSON.stringify(updatedProducts));
             setProducts(updatedProducts);
             console.log("Log S.36: Updated products saved to localStorage and state.");
             window.dispatchEvent(new Event('productsUpdated'));
             console.log("Log S.37: Dispatched 'productsUpdated' event.");

             if (stockUpdateErrors.length > 0) {
                 const errorMsg = "Stock update issues: " + stockUpdateErrors.join("; ");
                 console.error("Log S.38: Stock update errors summary:", errorMsg);
                 toast.warning("Some product stock updates failed. Check console for details.");
             } else if (!stockUpdateSuccessful) {
                   console.warn("Log S.38.1: Stock changes were calculated, but no products were found in master to update.");
             } else {
                  console.log("Log S.38.2: Product stock updated successfully based on bill changes.");
             }

         } catch (lsErrorProducts) {
             console.error("Log S.39: Error (Products Save): Error saving products to localStorage:", lsErrorProducts);
             toast.error("Error saving product stock data after sale. Local storage might be full.");
         }


        // --- Save or Update the Sales Bill ---
        let updatedSalesBills;
        let successMessage = '';
        let billSaveError = false;

        if (editingBill) {
            console.log("Log S.40: Attempting to update existing sales bill...");
             if (editingBill.billNumber.trim().toLowerCase() !== currentBillData.billNumber.toLowerCase() &&
                 salesBills.some(bill => bill.billNumber.toLowerCase() === currentBillData.billNumber.toLowerCase() && bill.id !== currentBillData.id)) {
                  console.error("Log S.40.1: Error (Editing): Sales bill number already exists.", currentBillData.billNumber);
                  toast.error(`Bill number "${currentBillData.billNumber}" already exists.`);
                  return;
             }
            updatedSalesBills = salesBills.map(bill =>
                bill.id === currentBillData.id ? currentBillData : bill
            );
            successMessage = `Sales Bill ${currentBillData.billNumber} updated successfully!`;
            console.log("Log S.41: Sales bill updated in memory list.", updatedSalesBills);

        } else { // Adding a new bill
             console.log("Log S.42: Attempting to add new sales bill...");
             if (salesBills.some(bill => bill.billNumber.toLowerCase() === currentBillData.billNumber.toLowerCase())) {
                 console.error("Log S.42.1: Error (Add): Sales bill number already exists.", currentBillData.billNumber);
                 toast.error(`Bill number "${currentBillData.billNumber}" already exists.`);
                 return;
             }
            console.log("Log S.43: Sales bill number is unique. Proceeding to add new bill.");
            updatedSalesBills = [...salesBills, currentBillData];
            successMessage = `Sales Bill ${currentBillData.billNumber} saved successfully!`;
            console.log("Log S.44: New sales bill added to memory list.", updatedSalesBills);
             // Add customer name to local storage if it's new (basic)
             const existingCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
             const customerNameTrimmed = customerName.trim();
             if(customerNameTrimmed && !existingCustomers.some(existingName => existingName.toLowerCase() === customerNameTrimmed.toLowerCase())){
                 const newCustomers = [...existingCustomers, customerNameTrimmed];
                 localStorage.setItem('customers', JSON.stringify(newCustomers));
                 setCustomers(newCustomers);
                 console.log(`Added new customer "${customerNameTrimmed}" to localStorage.`);
             }
             // --- Save the new bill number as the last used number ---
             saveLastBillNumber(currentBillData.billNumber); // Save the successfully saved bill number
             setLastSavedBillNumber(currentBillData.billNumber); // Update state
        }

        // --- Save Updated Sales Bills to Local Storage and State ---
        console.log("Log S.45: Attempting to save updated sales bills to localStorage.");
         try {
             localStorage.setItem('salesBills', JSON.stringify(updatedSalesBills));
             setSalesBills(updatedSalesBills);
             setFilteredSalesBills(updatedSalesBills);
             console.log("Log S.46: Updated sales bills saved to localStorage and state.");

             if (!billSaveError && stockUpdateSuccessful && stockUpdateErrors.length === 0) {
                 toast.success(successMessage);
                 console.log("Log S.47: Success toast shown.");
             } else if (!billSaveError && stockUpdateErrors.length > 0) {
                  toast.warning(`${successMessage} However, there were issues updating stock.`);
                  console.log("Log S.47.1: Success toast with stock warning shown.");
             } else if (!billSaveError) {
                   toast.info(`${successMessage} (No stock changes detected).`);
                   console.log("Log S.47.2: Success toast with no stock changes shown.");
             }

             if (!billSaveError) {
                 if (editingBill) {
                     console.log("Log S.48: Resetting editing state and closing dialog.");
                     setIsEditDialogOpen(false);
                     setEditingBill(null);
                     resetForm();
                 } else {
                     console.log("Log S.49: Resetting form.");
                     resetForm();
                 }
             }

         } catch (lsErrorBills) {
             console.error("Log S.50: Error (Bill Save): Error saving sales bills to localStorage:", lsErrorBills);
             toast.error("Error saving sales bill data. Local storage might be full.");
             billSaveError = true;
         }

         console.log("Log S.51: handleSaveOrUpdateBill finished.");

         if (billSaveError) {
         }
    };

    // Function to reset the form to initial state (for new entry)
    const resetForm = () => {
         console.log("Resetting sales form state.");
        setBillNumber(''); // Clear bill number on reset
        setCustomerName('');
        setDate(formatDate(new Date()));
        setSalesItems([{ product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]);
        setEditingBill(null);
        setIsEditDialogOpen(false);
        // Re-trigger auto-generation for the next bill number after reset
        // This useEffect will handle setting the next bill number because billNumber is now ''
        // const nextBillNumber = calculateNextBillNumber(lastSavedBillNumber);
        // setBillNumber(nextBillNumber); // Removed direct setting here
        console.log("Sales form reset.");
    };

     // Helper function to calculate the next bill number - Now handled by useEffect
     // const calculateNextBillNumber = (lastNumber) => { ... }


    // Function to start editing a sales bill
    const handleEditBill = (bill) => {
         console.log("Initiating edit for sales bill:", bill.billNumber);
        setEditingBill(bill);
        setBillNumber(bill.billNumber || '');
        setCustomerName(bill.customerName || '');
        setDate(bill.date || formatDate(new Date()));
        setSalesItems(bill.items.map(item => {
             const itemProductNameLower = item.product ? item.product.toLowerCase() : '';
             const availableBatchesForEdit = [];
              const seenBatchesForEdit = new Set();

              if (itemProductNameLower) {
                  purchaseBills.forEach(purchaseBill => {
                      purchaseBill.items.forEach(purchaseItem => {
                          if (purchaseItem.product.toLowerCase() === itemProductNameLower && purchaseItem.batch && purchaseItem.expiry) {
                               const batchIdentifier = `${purchaseItem.batch.trim().toLowerCase()}-${purchaseItem.expiry.trim().toLowerCase()}`;
                               if (!seenBatchesForEdit.has(batchIdentifier)) {
                                   availableBatchesForEdit.push({
                                       display: `Batch: ${purchaseItem.batch.trim()} - Exp: ${purchaseItem.expiry.trim()}`,
                                       batch: purchaseItem.batch.trim(),
                                       expiry: purchaseItem.expiry.trim(),
                                       ptr: Number(purchaseItem.ptr) || 0,
                                       itemsPerPack: Number(purchaseItem.itemsPerPack) || 1,
                                        unit: purchaseItem.unit || '',
                                        category: purchaseItem.category || '',
                                        company: purchaseItem.company || '',
                                   });
                                   seenBatchesForEdit.add(batchIdentifier);
                               }
                          }
                      });
                  });
              }

            return {
                ...item,
                 quantitySold: String(item.quantitySold ?? '') || '',
                 pricePerItem: String(item.pricePerItem ?? '') || '',
                 discount: String(item.discount ?? '') || '',
                 totalItemAmount: Number(item.totalItemAmount) || 0,
                 productMrp: String(item.productMrp ?? '') || '',
                 productItemsPerPack: String(item.productItemsPerPack ?? '') || '',
                 product: item.product || '',
                 batch: item.batch || '',
                 expiry: item.expiry || '',
                 unit: item.unit || '',
                 category: item.category || '',
                 company: item.company || '',
                 availableBatches: availableBatchesForEdit,
            };
        }));
        setIsEditDialogOpen(true);
        setSelectedBillDetails(null);
        setIsViewDialogOpen(false);
        console.log("Sales form state populated for editing.");
    };

    // Function to delete a sales bill
    const handleDeleteBill = (billId, billNumber) => {
         console.log(`Attempting to delete Sales Bill ID: ${billId}, Number: "${billNumber}"`);
        if (window.confirm(`Are you sure you want to delete Sales Bill ${billNumber}? This will attempt to revert the stock changes.`)) {
             console.log("User confirmed deletion. Proceeding.");
            // --- Revert Stock Changes on Deletion ---
            const billToDelete = salesBills.find(bill => bill.id === billId);
            if (!billToDelete) {
                 console.error(`Error (Delete Revert): Sales Bill with ID ${billId} not found. Cannot revert stock.`);
                 toast.error("Error: Could not find sales bill to delete and revert stock.");
            } else {
                 console.log("Found sales bill to delete. Reverting stock changes...");
                 const updatedProducts = products.map(p => ({ ...p }));
                 let stockReverted = false;
                 let stockRevertErrors = [];

                 billToDelete.items.forEach(item => {
                      const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === item.product.toLowerCase());

                      if (!productToUpdate) {
                          console.warn(`Warning (Delete Revert): Product "${item.product}" from deleted sales bill not found in current Product Master list. Cannot revert stock.`);
                          stockRevertErrors.push(`Stock could not be reverted for "${item.product}" (not found in master).`);
                          return;
                      }

                      const deletedQuantitySold = Number(item.quantitySold) || 0;
                      productToUpdate.quantity += deletedQuantitySold;
                      stockReverted = true;
                      console.log(`Reverted stock for "${item.product}" by adding back ${deletedQuantitySold}. New quantity: ${productToUpdate.quantity}`);
                       if (productToUpdate.quantity < 0) {
                            console.warn(`Warning: Product "${productToUpdate.name}" quantity went below zero after deletion reversion. Setting to 0.`);
                            productToUpdate.quantity = 0;
                       }
                 });


                 // --- Save Updated Products ---
                 if (stockReverted || stockRevertErrors.length > 0) {
                     console.log("Stock reverted or errors occurred during revert. Attempting to save updated products.");
                     try {
                         localStorage.setItem('products', JSON.stringify(updatedProducts));
                         setProducts(updatedProducts);
                         window.dispatchEvent(new Event('productsUpdated'));
                         console.log("Updated products saved after sales bill deletion and event dispatched.");

                         if (stockRevertErrors.length > 0) {
                              const errorMsg = "Stock reversion issues during deletion: " + stockRevertErrors.join("; ");
                              console.error("Stock reversion errors summary:", errorMsg);
                              toast.warning("Stock for some products could not be fully reverted.");
                         } else {
                              console.log("Product stock reverted successfully based on deleted bill.");
                         }

                     } catch (lsErrorRevert) {
                         console.error("Error (Products Save Revert): Error saving products after sales bill deletion:", lsErrorRevert);
                         toast.error("Error saving product stock data after sales bill deletion. Stock might be inconsistent.");
                     }
                 } else {
                      console.log("No stock reverted (no items found in Product Master). Skipping products localStorage save.");
                       if (stockRevertErrors.length > 0) {
                           toast.warning("Stock for some products could not be reverted.");
                       }
                 }
            }


            // --- Delete the Bill ---
            console.log("Attempting to delete the sales bill from localStorage and state.");
            try {
                 const updatedSalesBills = salesBills.filter(bill => bill.id !== billId);
                 localStorage.setItem('salesBills', JSON.stringify(updatedSalesBills));
                 setSalesBills(updatedSalesBills);
                 setFilteredSalesBills(updatedSalesBills);
                 console.log("Sales bill deleted from localStorage and state.");

                 toast.success(`Sales Bill ${billNumber} deleted.`);
                 console.log("Sales bill deletion success toast shown.");

                 if (editingBill && editingBill.id === billId) {
                      console.log("Deleted sales bill was being edited. Resetting form.");
                      resetForm();
                 }
                 if (selectedBillDetails && selectedBillDetails.id === billId) {
                      console.log("Deleted sales bill was being viewed. Closing view dialog.");
                      setSelectedBillDetails(null);
                      setIsViewDialogOpen(false);
                 }
            } catch (lsErrorDeleteBill) {
                 console.error("Log S.52 (Delete Bill): Error deleting sales bill from localStorage:", lsErrorDeleteBill);
                 toast.error("Error deleting sales bill data. Local storage might be full.");
            }
             console.log("handleDeleteBill finished.");
        } else {
             console.log("Sales bill deletion cancelled by user.");
        }
    };

    // Function to view sales bill details
    const handleViewBill = (bill) => {
         console.log("Viewing sales bill:", bill.billNumber);
        setSelectedBillDetails(bill);
        setIsViewDialogOpen(true);
        setIsEditDialogOpen(false);
    };

    // Function to close the view dialog
    const handleCloseViewDialog = () => {
         console.log("Closing view dialog.");
        setSelectedBillDetails(null);
        setIsViewDialogOpen(false);
    };

    // Function to close the edit dialog
    const handleCloseEditDialog = () => {
         console.log("Closing edit dialog. Resetting form state.");
        setEditingBill(null);
        setIsEditDialogOpen(false);
        resetForm();
    };


    // Get product suggestions based on user input for datalist
    const getProductSuggestions = (inputValue) => {
        const query = inputValue.toLowerCase();
        return products
               .filter(product => product.name.toLowerCase().includes(query))
               .map(product => product.name)
               .slice(0, 20);
    };

     // Get customer suggestions based on user input for datalist
     const getCustomerSuggestions = (inputValue) => {
         const query = inputValue.toLowerCase();
         return customers
                .filter(customer => customer.toLowerCase().includes(query))
                .slice(0, 20);
     };


    // Render logic starts here
    return (
        <div>
            <Header />
             {/* Added fade-in class to the main container */}
             <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-gray-100 rounded-lg shadow-inner fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800">{editingBill ? 'Edit Sales Bill' : 'New Sales Entry'}</h2>
                    <Button
                        onClick={() => router.push("/")}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
                    >
                        Go to Dashboard
                    </Button>
                </div>

                {/* Sales Bill Form */}
                 <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                      <h3 className="text-2xl font-semibold text-gray-700 mb-5 border-b pb-3 border-gray-200">
                           {editingBill ? 'Edit Bill Details' : 'Bill Details'}
                       </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                         <div>
                             <label htmlFor="billNumber" className="block text-sm font-medium text-gray-700 mb-1">Bill/Invoice Number (Required)</label>
                             <input
                                 id="billNumber"
                                 type="text"
                                 placeholder="Enter Bill/Invoice Number"
                                 value={billNumber}
                                 onChange={(e) => setBillNumber(e.target.value)}
                                 className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-gray-800 placeholder-gray-400"
                                 required
                             />
                         </div>
                           <div>
                             <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Customer Name (Required)</label>
                             <input
                                 id="customerName"
                                 type="text"
                                 placeholder="Enter Customer Name"
                                 value={customerName}
                                 onChange={(e) => setCustomerName(e.target.value)}
                                 className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-gray-800 placeholder-gray-400"
                                  list="customer-suggestions"
                                 required
                             />
                              <datalist id="customer-suggestions">
                                  {getCustomerSuggestions(customerName).map((customer, index) => (
                                      <option key={index} value={customer} />
                                  ))}
                              </datalist>
                         </div>

                           <div>
                             <label htmlFor="billDate" className="block text-sm font-medium text-gray-700 mb-1">Bill Date (DD-MM-YYYY)</label>
                             <input
                                 id="billDate"
                                 type="text"
                                 placeholder="e.g., 01-01-2023"
                                 value={date}
                                 onChange={handleDateChange}
                                 className="w-full p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
                                 required
                             />
                         </div>
                      </div>

                       <h4 className="text-xl font-semibold text-gray-700 mb-3 border-b pb-2 border-gray-200">Sales Items</h4>
                        <div className="overflow-x-auto mb-6 border border-gray-200 rounded-md shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product (Req.)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No. (Req.)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry (MM-YY) (Req.)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity (Items) (Req.)</th>
                                         <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items/Pack</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Item (Req. ≥0)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (%)</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                        <th scope="col" className="relative px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <span className="sr-only">Actions</span>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {salesItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-100 transition duration-100 ease-in-out">
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.product}
                                                    onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
                                                    list={`product-suggestions-${index}`}
                                                    required
                                                />
                                                <datalist id={`product-suggestions-${index}`}>
                                                    {getProductSuggestions(item.product).map((productName, i) => (
                                                        <option key={i} value={productName} />
                                                    ))}
                                                </datalist>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    placeholder="Batch No."
                                                    value={item.batch}
                                                    onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
                                                    list={`batch-suggestions-${index}`}
                                                    required
                                                />
                                                <datalist id={`batch-suggestions-${index}`}>
                                                    {item.availableBatches.map((batchDetail, i) => (
                                                        <option key={i} value={batchDetail.display} />
                                                    ))}
                                                </datalist>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    placeholder="MM-YY"
                                                    value={item.expiry}
                                                     // onChange={(e) => handleItemChange(index, 'expiry', e.target.value)} // Keep handler in case manual edit is needed, but disabled for visual cue
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                     readOnly
                                                     disabled
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    placeholder="Items"
                                                    value={item.quantitySold}
                                                    onChange={(e) => handleItemChange(index, 'quantitySold', e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
                                                    min="0"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    placeholder="MRP"
                                                    value={item.productMrp}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                     readOnly disabled
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                 <input
                                                     type="text"
                                                     placeholder="Items/Pack"
                                                     value={item.productItemsPerPack}
                                                     className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                     readOnly disabled
                                                 />
                                             </td>

                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    placeholder="Price/Item"
                                                    value={item.pricePerItem}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                     readOnly
                                                     disabled
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    value={item.discount}
                                                    onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                                                    className="w-full p-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400"
                                                    min="0"
                                                    max="100"
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                     // onChange={(e) => handleItemChange(index, 'unit', e.target.value)} // Keep handler if needed, but disabled
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                    readOnly disabled
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.category}
                                                     // onChange={(e) => handleItemChange(index, 'category', e.target.value)} // Keep handler
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                    readOnly disabled
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="text"
                                                    value={item.company}
                                                     // onChange={(e) => handleItemChange(index, 'company', e.target.value)} // Keep handler
                                                    className="w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                                                    readOnly disabled
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-800">
                                                ₹{(Number(item.totalItemAmount) || 0).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                                                {salesItems.length > 1 && (
                                                    <Button
                                                         size="sm"
                                                         onClick={() => removeItem(index)}
                                                         className="inline-flex items-center p-1 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                                                         title="Remove Item"
                                                     >
                                                         <X className="h-4 w-4" />
                                                     </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>


                       {/* Add Item Button */}
                        <Button
                            onClick={addItem}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>

                       {/* Grand Total */}
                       <div className="flex justify-end my-6">
                           <div className="text-xl font-bold text-gray-800">
                               Grand Total: ₹{calculateGrandTotal().toFixed(2)}
                           </div>
                       </div>

                       {/* Save/Update and Cancel Buttons */}
                       <div className="flex justify-start space-x-3">
                           <Button
                                onClick={handleSaveOrUpdateBill}
                               className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                           >
                                <Save className="mr-2 h-4 w-4" /> {editingBill ? 'Update Bill' : 'Save Bill'}
                           </Button>
                           {editingBill && (
                                <Button
                                     onClick={handleCloseEditDialog}
                                     className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                                 >
                                     Cancel Edit
                                 </Button>
                           )}
                            {!editingBill && (
                                 <Button
                                      onClick={resetForm}
                                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                                  >
                                      Reset Form
                                  </Button>
                            )}
                       </div>
                   </div>


                <hr className="my-8 border-gray-300" />

                {/* Sales Bill List Section */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                     <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3 border-gray-200">Sales Bill History</h3>
                     <div className="mb-6">
                         <input
                             type="text"
                             placeholder="Search by Bill No, Customer, or Date..."
                             value={searchQuery}
                             onChange={handleSearchChange}
                             className="w-full md:w-1/3 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-gray-800 placeholder-gray-400"
                         />
                     </div>

                     <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                         <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                                 <tr>
                                     <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill No</th>
                                     <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                     <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                     <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                     <th scope="col" className="relative px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                         <span className="sr-only">Actions</span>
                                         Actions
                                     </th>
                                 </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                 {/* Added fade-in-item class to table rows */}
                                 {filteredSalesBills.length > 0 ? (
                                     filteredSalesBills.map((bill) => (
                                         <tr key={bill.id} className="hover:bg-gray-100 transition duration-100 ease-in-out fade-in-item">
                                             <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{bill.billNumber}</td>
                                             <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{bill.customerName}</td>
                                             <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{bill.date}</td>
                                             <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-800">₹{Number(bill.totalAmount).toFixed(2)}</td>
                                             <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                                                 <div className="flex justify-center space-x-2">
                                                     <Button
                                                          variant="outline"
                                                          size="sm"
                                                          onClick={() => handleViewBill(bill)}
                                                          className="inline-flex items-center p-1 border border-transparent rounded-md shadow-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                                                          title="View Details"
                                                      >
                                                          <Eye className="h-4 w-4" />
                                                      </Button>
                                                      <Button
                                                           variant="outline"
                                                           size="sm"
                                                           onClick={() => handleEditBill(bill)}
                                                           className="inline-flex items-center p-1 border border-transparent rounded-md shadow-sm text-yellow-600 hover:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors duration-200"
                                                           title="Edit Bill"
                                                       >
                                                           <Edit className="h-4 w-4" />
                                                       </Button>
                                                      <Button
                                                           variant="destructive"
                                                           size="sm"
                                                           onClick={() => handleDeleteBill(bill.id, bill.billNumber)}
                                                           className="inline-flex items-center p-1 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                                                           title="Delete Bill"
                                                       >
                                                           <Trash2 className="h-4 w-4" />
                                                       </Button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))
                                  ) : (
                                      <tr>
                                          <td colSpan="5" className="px-3 py-2 whitespace-nowrap text-center text-sm text-gray-500">No sales bills found</td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>


                  {/* View Bill Dialog (Styled) */}
                  {isViewDialogOpen && selectedBillDetails && (
                      // Removed animation classes from backdrop
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                           {/* Removed animation classes from dialog content and kept z-10 */}
                          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 border border-gray-200 z-10">
                              {/* Added console log to check selectedBillDetails */}
                              {console.log("Rendering View Dialog. selectedBillDetails:", selectedBillDetails)}
                              <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-200">
                                  <h3 className="text-xl font-semibold text-gray-800">Sales Bill Details: {selectedBillDetails.billNumber}</h3>
                                  <Button
                                       size="sm"
                                       onClick={handleCloseViewDialog}
                                       className="inline-flex items-center p-1 border border-gray-300 rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                                       title="Close"
                                   >
                                       <X className="h-4 w-4" />
                                   </Button>
                              </div>
                              <div className="mb-4 text-gray-700">
                                  <p className="mb-1"><strong>Customer:</strong> {selectedBillDetails.customerName}</p>
                                  <p><strong>Date:</strong> {selectedBillDetails.date}</p>
                              </div>
                              <h4 className="font-semibold text-gray-800 mt-4 mb-3 border-b pb-2 border-gray-200">Items:</h4>
                              <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                                      <thead className="bg-gray-50">
                                           <tr>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (Items)</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items/Pack</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Item</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount (%)</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                               <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Total</th>
                                           </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                           {/* Check if selectedBillDetails.items is an array before mapping */}
                                           {selectedBillDetails.items && Array.isArray(selectedBillDetails.items) && selectedBillDetails.items.map((item, itemIndex) => (
                                               <tr key={itemIndex} className="hover:bg-gray-50 transition duration-100 ease-in-out">
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.product || '-'}</td> {/* Added fallback '-' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.quantitySold || '0'}</td> {/* Added fallback '0' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.batch || '-'}</td> {/* Added fallback '-' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.expiry || '-'}</td> {/* Added fallback '-' */}
                                                     <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.productMrp ? `₹${Number(item.productMrp).toFixed(2)}` : '-'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.productItemsPerPack || '-'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">₹{Number(item.pricePerItem).toFixed(2) || '0.00'}</td> {/* Added fallback '0.00' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.discount ?? '0'}%</td> {/* Use ?? '0' for discount */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.unit || '-'}</td> {/* Added fallback '-' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.category || '-'}</td> {/* Added fallback '-' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.company || '-'}</td> {/* Added fallback '-' */}
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-800">₹{Number(item.totalItemAmount).toFixed(2) || '0.00'}</td> {/* Added fallback '0.00' */}
                                               </tr>
                                           ))}
                                            {/* Add a row if no items are present */}
                                             {selectedBillDetails.items && Array.isArray(selectedBillDetails.items) && selectedBillDetails.items.length === 0 && (
                                                 <tr>
                                                     <td colSpan="12" className="px-3 py-4 text-center text-sm text-gray-500">No items found for this bill.</td>
                                                 </tr>
                                             )}
                                      </tbody>
                                  </table>
                              </div>
                              <p className="text-lg font-bold text-gray-800 mt-6 text-right">Grand Total: ₹{Number(selectedBillDetails.totalAmount).toFixed(2)}</p>
                               <div className="flex justify-end mt-6">
                                    <Button
                                        onClick={handleCloseViewDialog}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                                    >
                                        Close
                                    </Button>
                                </div>
                           </div>
                       </div>
                   )}


            </div>
            <style jsx>{`
                .fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeIn {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .fade-in-item {
                    opacity: 0;
                    animation: fadeInItem 0.5s ease-out forwards;
                }
                @keyframes fadeInItem {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                /* Removed dialog animation styles */
                /*
                .dialog-backdrop-fade-in {
                    animation: dialogBackdropFadeIn 0.3s ease-out forwards;
                    opacity: 0;
                }
                @keyframes dialogBackdropFadeIn {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .dialog-content-fade-scale-in {
                    opacity: 0;
                    transform: scale(0.95);
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                */
            `}</style>
        </div>
    );
};

export default SalesPage;
