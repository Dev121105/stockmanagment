// app/sales/page.js
"use client"; // This directive is needed for client-side functionality

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/button'; // Adjust path as per your project structure
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path as per your project structure
import { toast } from 'sonner'; // Assuming you use Sonner for toasts
import { Trash2, Eye, Plus, X, Edit } from 'lucide-react'; // Importing necessary icons

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
    const [customerName, setCustomerName] = useState(''); // State for customer name
    const [date, setDate] = useState(formatDate(new Date())); // Default to today's date formatted
    // salesItems state includes fields specific to a sales item, ADDED availableBatches, productMrp, productItemsPerPack
    // REMOVED taxRate from state structure
    const [salesItems, setSalesItems] = useState([{ product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]); // Initial row with new fields


    // State for managing bills and products data
    const [salesBills, setSalesBills] = useState([]); // State for sales bills
    // Products state holds data from Product Master (including MRP, unit, category, itemsPerPack, etc.)
    const [products, setProducts] = useState([]); // Used for product lookups and stock updates
     // Purchase bills are needed to find available batches, expiry for batch auto-fetch (PTR/itemsPerPack from purchase NOT used for sales price)
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [customers, setCustomers] = useState([]); // State for customers for datalist suggestions (Assuming you manage customers similarly to suppliers)

    // State for search and filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredSalesBills, setFilteredSalesBills] = useState([]);

    // State for viewing bill details in a dialog
    const [selectedBillDetails, setSelectedBillDetails] = useState(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

    // State for editing bill details in a dialog
    const [editingBill, setEditingBill] = useState(null); // Holds the *original* bill object being edited
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // Controls the visibility of the edit dialog


    const router = useRouter(); // Assuming Next.js router

    // --- Data Loading from localStorage ---
    useEffect(() => {
        console.log("SalesPage useEffect: Component mounted. Initiating data loads.");

        const loadProducts = () => {
             console.log("SalesPage useEffect: Loading products from localStorage..."); // Debugging log
            const storedProducts = localStorage.getItem('products');
            if (storedProducts) {
                try {
                    const parsedProducts = JSON.parse(storedProducts);
                     // Ensure numeric fields are numbers on load for product master data
                    const updatedProducts = parsedProducts.map(product => ({
                        ...product,
                         quantity: Number(product.quantity) || 0, // Stock quantity (individual items)
                         mrp: Number(product.mrp) || 0, // Selling price (per item?)
                         itemsPerPack: Number(product.itemsPerPack) || 1, // Items per pack
                         minStock: Number(product.minStock) || 0,
                         maxStock: Number(product.maxStock) || 0,
                         discount: Number(product.discount) || 0, // Default discount
                         // taxRate: Number(product.taxRate) || 0, // REMOVED taxRate from loading
                         // Ensure consistent structure, default missing fields
                         name: product.name || '',
                         unit: product.unit || '',
                         category: product.category || '',
                         company: product.company || '',
                         id: product.id, // Ensure ID is present
                         // batch/expiry are not on master product ideally, but included defensively
                         batch: product.batch || '',
                         expiry: product.expiry || '',
                    })).filter(product => product.name); // Filter out any entries without a name

                    setProducts(updatedProducts);
                     console.log("SalesPage useEffect: Products loaded and parsed:", updatedProducts.length); // Debugging log
                } catch (error) {
                    console.error("SalesPage useEffect: Error parsing products from localStorage:", error);
                    setProducts([]);
                    toast.error("Error loading product master data.");
                }
            } else {
                     console.log("SalesPage useEffect: No products found in localStorage."); // Debugging log
                     setProducts([]);
            }
        };

        // Need to load purchase bills to find available batches, expiry
        const loadPurchaseBills = () => {
             console.log("SalesPage useEffect: Loading purchase bills from localStorage..."); // Debugging log
            const storedBills = localStorage.getItem('purchaseBills');
            if (storedBills) {
                try {
                    const parsedBills = JSON.parse(storedBills);
                     // Process purchase bills similar to purchase bills for consistency
                    const processedBills = parsedBills.map(bill => ({
                        ...bill,
                        date: bill.date || '', // Keep date as string
                        items: bill.items.map(item => ({
                            ...item,
                             // Essential fields for sales batch lookup and stock tracking
                             product: item.product || '',
                             batch: item.batch || '',
                             expiry: item.expiry || '', // Expiry of this specific batch purchase (MM-YY)
                             // quantity: Number(item.quantity) || 0, // This was total items *in this purchase line*. Not current stock of this batch.
                             // For now, stock tracking of batches is simplified. Need a separate structure for true batch stock.
                             ptr: Number(item.ptr) || 0, // PTR per pack (for reference if needed later)
                             itemsPerPack: Number(item.itemsPerPack) || 1, // Items per pack from purchase (for reference if needed later)
                             // Include other fields that might be useful to display in batch selection
                             unit: item.unit || '',
                             category: item.category || '',
                             company: item.company || '',
                             // Keep other fields from purchase item if they exist
                             packsPurchased: Number(item.packsPurchased) || 0,
                             discount: Number(item.discount) || 0,
                             taxRate: Number(item.taxRate) || 0, // Keep tax rate from purchase for record, but not used in sales calculation
                        })),
                    }));
                    setPurchaseBills(processedBills); // Store processed purchase bills
                     console.log("SalesPage useEffect: Purchase bills loaded and processed:", processedBills.length);
                } catch (error) {
                    console.error("SalesPage useEffect: Error parsing purchase bills from localStorage:", error);
                    setPurchaseBills([]); // Clear purchase bills on error
                    toast.error("Error loading purchase bill data for batch info.");
                }
            } else {
                     console.log("SalesPage useEffect: No purchase bills found in localStorage.");
                     setPurchaseBills([]);
            }
        };


        // Load existing sales bills
        const loadSalesBills = () => {
             console.log("SalesPage useEffect: Loading sales bills from localStorage..."); // Debugging log
            const storedBills = localStorage.getItem('salesBills'); // Use 'salesBills' key
            if (storedBills) {
                try {
                    const parsedBills = JSON.parse(storedBills);
                     // Process sales bills for consistency
                    const processedBills = parsedBills.map(bill => ({
                        ...bill,
                        // Ensure bill date is formatted for display
                        date: bill.date ? (formatDate(parseDate(bill.date)) || bill.date || '') : '',
                        // Ensure totalAmount is a number
                        totalAmount: Number(bill.totalAmount) || 0,
                        customerName: bill.customerName || '', // Ensure customerName exists
                        items: bill.items.map(item => ({
                            ...item,
                             // Ensure numeric fields are numbers
                             quantitySold: Number(item.quantitySold) || 0, // Quantity sold (individual items)
                             pricePerItem: Number(item.pricePerItem) || 0, // Price per item
                             discount: Number(item.discount) || 0,
                             // taxRate: Number(item.taxRate) || 0, // REMOVED taxRate from loading sales item
                             totalItemAmount: Number(item.totalItemAmount) || 0, // Item total saved with bill item
                             // ADDED loading productMrp and productItemsPerPack from saved data
                             productMrp: Number(item.productMrp) || 0,
                             productItemsPerPack: Number(item.productItemsPerPack) || 1,
                             // Ensure other fields are carried over
                             product: item.product || '',
                             batch: item.batch || '', // Batch sold from
                             expiry: item.expiry || '', // Expiry of batch sold from (MM-YY)
                             unit: item.unit || '', category: item.category || '', company: item.company || '', // Details saved with item
                        })),
                    }));
                    setSalesBills(processedBills); // Store processed sales bills
                    setFilteredSalesBills(processedBills); // Filtered list starts as all bills
                     console.log("SalesPage useEffect: Sales bills loaded and parsed:", processedBills.length);
                } catch (error) {
                    console.error("SalesPage useEffect: Error parsing sales bills from localStorage:", error);
                    setSalesBills([]);
                    setFilteredSalesBills([]);
                    toast.error("Error loading sales bill data.");
                }
            } else {
                     console.log("SalesPage useEffect: No sales bills found in localStorage.");
                     setSalesBills([]);
                     setFilteredSalesBills([]);
            }
        };

         // Need to load customers from localStorage for suggestions
         const loadCustomers = () => {
              console.log("SalesPage useEffect: Loading customers from localStorage..."); // Debugging log
             const storedCustomers = localStorage.getItem('customers'); // Use 'customers' key
             if (storedCustomers) {
                 try {
                     const parsedCustomers = JSON.parse(storedCustomers);
                     // Assuming customers are stored as an array of strings or objects with a name property
                     // If array of objects: setCustomers(parsedCustomers.map(c => c.name));
                     // If array of strings:
                     setCustomers(parsedCustomers); // Assuming array of strings for simplicity
                      console.log("SalesPage useEffect: Customers loaded and parsed:", parsedCustomers.length);
                 } catch (error) {
                     console.error("SalesPage useEffect: Error parsing customers from localStorage:", error);
                     setCustomers([]);
                     toast.error("Error loading customer data.");
                 }
             } else {
                  console.log("SalesPage useEffect: No customers found in localStorage.");
                  setCustomers([]); // Initialize with empty array if none found
             }
         };


        // Initial load of all necessary data
         console.log("SalesPage useEffect: Component mounted. Initiating data loads.");
        loadProducts(); // Load products for lookup and stock update
        loadPurchaseBills(); // Load purchase data (needed for batch/expiry/price derivation)
        loadSalesBills(); // Load existing sales data
        loadCustomers(); // Load customer data

        // Set up event listener for product updates from Product Master or Purchase
        const handleProductsUpdated = () => {
             console.log("SalesPage: 'productsUpdated' event received. Reloading products and purchase bills.");
             // Reload products AND purchase bills when this event fires
            loadProducts();
            loadPurchaseBills(); // Reload purchase data to get latest stock/batch info
        };

        console.log("SalesPage useEffect: Adding 'productsUpdated' event listener.");
        window.addEventListener('productsUpdated', handleProductsUpdated);

        // Clean up event listener on component unmount
        return () => {
             console.log("SalesPage useEffect: Component unmounting. Removing event listener.");
            window.removeEventListener('productsUpdated', handleProductsUpdated);
        };

    }, []); // Empty dependency array means this runs only once on mount


    // Update filtered sales bills when searchQuery or salesBills change
    useEffect(() => {
         console.log("SalesPage filter useEffect: Search query or salesBills updated. Filtering bills.");
        const query = searchQuery.toLowerCase();
        const filtered = salesBills.filter(bill =>
            bill.billNumber.toLowerCase().includes(query) ||
            bill.customerName.toLowerCase().includes(query) || // Filter by customer name
            bill.date.includes(query) // Assuming date is stored/formatted as DD-MM-YYYY string for search
        );
        setFilteredSalesBills(filtered);
         console.log("SalesPage filter useEffect: Filtered sales bills count:", filtered.length);
        // Reset selected bill details and editing bill when search query changes
        setSelectedBillDetails(null);
        setEditingBill(null);
        setIsViewDialogOpen(false);
        setIsEditDialogOpen(false);
    }, [searchQuery, salesBills]); // Dependencies are searchQuery and salesBills

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
             // Clear batch, expiry, price, etc. when product changes
             updatedItems[index]['batch'] = '';
             updatedItems[index]['expiry'] = '';
             updatedItems[index]['quantitySold'] = ''; // Clear quantity sold
             updatedItems[index]['pricePerItem'] = ''; // Clear calculated price
             updatedItems[index]['discount'] = ''; // Clear default discount
             // updatedItems[index]['taxRate'] = ''; // REMOVED taxRate from clearing
             updatedItems[index]['unit'] = '';
             updatedItems[index]['category'] = '';
             updatedItems[index]['company'] = '';
             updatedItems[index]['totalItemAmount'] = 0; // Reset item total
             // ADDED clearing MRP and Items/Pack when product changes
             updatedItems[index]['productMrp'] = '';
             updatedItems[index]['productItemsPerPack'] = '';


             // Find all unique batches for this product from purchase bills
             const availableBatches = [];
             const seenBatches = new Set(); // Use Set to ensure unique batches based on batch number and expiry

             if (value.trim() !== '') {
                 const productNameLower = value.trim().toLowerCase();
                 purchaseBills.forEach(purchaseBill => {
                     purchaseBill.items.forEach(purchaseItem => {
                         // Match product name (case-insensitive) AND check if batch/expiry are present
                         if (purchaseItem.product.toLowerCase() === productNameLower && purchaseItem.batch && purchaseItem.expiry) {
                             // Create a unique identifier for the batch (e.g., "Batch ABC - Exp 12-25")
                             // Normalize batch and expiry strings for consistent matching
                             const batchIdentifier = `${purchaseItem.batch.trim().toLowerCase()}-${purchaseItem.expiry.trim().toLowerCase()}`;

                             // Add to available batches if this combination hasn't been added yet
                             if (!seenBatches.has(batchIdentifier)) {
                                  // Store necessary details for batch selection and later lookup
                                  availableBatches.push({
                                      // Display string for the datalist option
                                      display: `Batch: ${purchaseItem.batch.trim()} - Exp: ${purchaseItem.expiry.trim()}`,
                                      batch: purchaseItem.batch.trim(), // Actual batch number
                                      expiry: purchaseItem.expiry.trim(), // Actual expiry string (MM-YY)
                                      ptr: Number(purchaseItem.ptr) || 0, // PTR per pack (for reference if needed later)
                                      itemsPerPack: Number(purchaseItem.itemsPerPack) || 1, // Items per pack from purchase (for reference if needed later)
                                      // Also include unit, category, company from purchase item for consistency
                                      unit: purchaseItem.unit || '',
                                      category: purchaseItem.category || '',
                                      company: purchaseItem.company || '',
                                      // Note: This doesn't store the *current available stock* of this batch.
                                      // That requires more complex logic across purchase and sale history.
                                  });
                                  seenBatches.add(batchIdentifier);
                             }
                         }
                     });
                 });
                  console.log(`Item ${index}: Found ${availableBatches.length} unique batch/expiry combinations for product "${value.trim()}".`);
             }
             // Store the list of available batches for this item row state
             updatedItems[index]['availableBatches'] = availableBatches;

             // Also pre-fill unit, category, company, MRP, and ItemsPerPack from Product Master if product found
              if (value.trim() !== '') {
                  const selectedProductMaster = products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
                  if (selectedProductMaster) {
                      updatedItems[index]['unit'] = selectedProductMaster.unit || '';
                      updatedItems[index]['category'] = selectedProductMaster.category || '';
                      updatedItems[index]['company'] = selectedProductMaster.company || '';
                      updatedItems[index]['discount'] = String(selectedProductMaster.discount || 0) || ''; // Use default discount from master
                       // removed taxRate prefill
                       // ADDED Pre-filling MRP and Items/Pack from Product Master
                       const mrp = Number(selectedProductMaster.mrp) || 0;
                       const itemsPerPack = Number(selectedProductMaster.itemsPerPack) || 1;
                       updatedItems[index]['productMrp'] = String(mrp); // Pre-fill MRP from master
                       updatedItems[index]['productItemsPerPack'] = String(itemsPerPack); // Pre-fill Items/Pack from master


                       // --- KEY CHANGE: Calculate PricePerItem as MRP / ItemsPerPack from Product Master ---
                       const calculatedPricePerItem = (itemsPerPack > 0) ? (mrp / itemsPerPack) : mrp; // Avoid division by zero, default to MRP if Items/Pack is 0 or 1
                       updatedItems[index]['pricePerItem'] = calculatedPricePerItem.toFixed(2); // Store as string formatted to 2 decimal places
                       console.log(`Item ${index}: Product "${value.trim()}" selected. Setting Price/Item to (MRP / ItemsPerPack) = (${mrp} / ${itemsPerPack}) = ${updatedItems[index]['pricePerItem']}`);


                  } else {
                       // If product not found in master, clear MRP, Items/Pack, and Price/Item
                       updatedItems[index]['productMrp'] = '';
                       updatedItems[index]['productItemsPerPack'] = '';
                       updatedItems[index]['pricePerItem'] = ''; // Clear Price/Item if product not found
                       console.warn(`Item ${index}: Product "${value.trim()}" not found in Product Master. MRP, Items/Pack, and Price/Item cleared.`);
                  }
              }


        }

        // --- Logic for Batch Selection (Triggered by user typing or selecting from datalist) ---
         if (field === 'batch') {
             // Find the selected batch details from the available batches list stored in the item state
             // Match the raw value entered by the user (which could be the full display string from datalist)
             // Use case-insensitive and trimmed comparison for robustness
             const selectedBatchDetail = updatedItems[index]['availableBatches'].find(batch => batch.display.trim().toLowerCase() === value.trim().toLowerCase());

             if (selectedBatchDetail) {
                 console.log(`Item ${index}: Batch "${value.trim()}" selected from suggestions. Auto-filling Expiry and basic info.`);
                 // Populate batch, expiry, unit, category, company from selected batch details
                 updatedItems[index]['batch'] = selectedBatchDetail.batch; // Use the actual batch number
                 updatedItems[index]['expiry'] = selectedBatchDetail.expiry; // Use expiry from the purchase data (MM-YY)

                 // Prioritize batch data for these fields if available, otherwise keep what's there (from product master)
                 updatedItems[index]['unit'] = selectedBatchDetail.unit || updatedItems[index]['unit'] || '';
                 updatedItems[index]['category'] = selectedBatchDetail.category || updatedItems[index]['category'] || '';
                 updatedItems[index]['company'] = selectedBatchDetail.company || updatedItems[index]['company'] || '';


                 // PricePerItem is NOT recalculated here. It was set based on Product MRP when the product was selected.
                 console.log(`Item ${index}: Auto-filled Expiry: ${selectedBatchDetail.expiry}. Price/Item remains based on Product MRP.`);


                 // Clear quantity sold when batch changes, as stock needs re-evaluation (stock check is in validation)
                 updatedItems[index]['quantitySold'] = '';
                  updatedItems[index]['totalItemAmount'] = 0; // Recalculate total based on cleared quantity
                 // Note: At this point, you might want to check the *current available stock* for this batch.
                 // This requires summing up quantity from all purchase items of this batch
                 // and subtracting quantity from all sales items of this batch. This is complex.
                 // For now, stock validation is a simplified check against overall product quantity during save.

             } else {
                 console.log(`Item ${index}: Selected batch display "${value.trim()}" not found in available batches for exact match.`);
                 // If the user typed something that doesn't exactly match a datalist option,
                 // keep their input for batch but clear dependent fields related to the batch details.
                 updatedItems[index]['batch'] = value; // Keep user input for batch
                 updatedItems[index]['expiry'] = ''; // Clear expiry
                 // PricePerItem is NOT cleared here, it stays based on Product MRP
                 // Clear derived details from batch if no batch is selected
                 updatedItems[index]['unit'] = updatedItems[index]['unit'] || ''; // Revert to product master value if any, or empty
                 updatedItems[index]['category'] = updatedItems[index]['category'] || ''; // Revert to product master value if any, or empty
                 updatedItems[index]['company'] = updatedItems[index]['company'] || ''; // Revert to product master value if any, or empty

                 updatedItems[index]['totalItemAmount'] = 0; // Recalculates to 0 because quantity is cleared
                 updatedItems[index]['quantitySold'] = ''; // Clear quantity

                 // Display a warning if the entered batch doesn't match suggestions, unless it's empty
                 if (value.trim() !== '') {
                      toast.warning(`Entered batch "${value.trim()}" doesn't match known batches for this product. Expiry not auto-filled.`);
                 }
             }
         }

         // --- Logic for Expiry Change (Only if manually edited after batch selection) ---
         if (field === 'expiry') {
              // If the user manually changes expiry after a batch was potentially selected,
              // you might want to re-evaluate the price or validation.
              // For now, we just update the expiry value in state.
              console.log(`Item ${index}: Manual expiry change to "${value}".`);
              // If you allow manual expiry change, ensure it's validated in validateFormData
         }


        // Recalculate totalItemAmount whenever quantitySold, pricePerItem, or discount changes
         if (['quantitySold', 'pricePerItem', 'discount'].includes(field)) {
             const quantity = Number(updatedItems[index]['quantitySold']) || 0;
             const price = Number(updatedItems[index]['pricePerItem']) || 0; // Use the Price/Item (now based on MRP/ItemsPerPack)
             const discount = Number(updatedItems[index]['discount']) || 0;

             // Recalculate total item amount: Quantity * (Price/Item * (1 - Discount %))
             if (quantity >= 0 && price >= 0 && discount >= 0 && discount <= 100) {
                 const priceAfterDiscountPerItem = price * (1 - (discount / 100));
                 updatedItems[index]['totalItemAmount'] = quantity * priceAfterDiscountPerItem; // Calculate total for the item line
                  console.log(`Item ${index}: Calculated item total ${updatedItems[index]['totalItemAmount'].toFixed(2)} (qty: ${quantity}, price/item: ${price}, discount: ${discount}%)`); // Debugging log
             } else {
                 updatedItems[index]['totalItemAmount'] = 0; // Default to 0 if inputs are invalid
                  console.log(`Item ${index}: Invalid inputs for total calculation. Total set to 0.`); // Debugging log
             }
         }


        setSalesItems(updatedItems);
    };

    // Add new sales item row
    const addItem = () => {
         console.log("Adding new item row."); // Debugging log
        // Add new item with empty fields by default, including availableBatches, productMrp, productItemsPerPack
        setSalesItems([...salesItems, { product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]); // NO taxRate
    };

    // Remove sales item row
    const removeItem = (index) => {
         console.log(`Removing item row at index ${index}.`); // Debugging log
        const updatedItems = [...salesItems];
        updatedItems.splice(index, 1);
        setSalesItems(updatedItems);
    };

    // Calculate grand total for the entire sale
    const calculateGrandTotal = () => {
         console.log("Calculating grand total..."); // Debugging log
        // Ensure totalItemAmount is treated as a number
        const total = salesItems.reduce((sum, item) => sum + (Number(item.totalItemAmount) || 0), 0);
         console.log("Grand total calculated:", total.toFixed(2)); // Debugging log
        return total;
    };

    // Handle search query change for bills list
    const handleSearchChange = (e) => {
         console.log("Search query changed:", e.target.value); // Debugging log
        setSearchQuery(e.target.value);
    };

    // Function to validate form data before saving
    const validateFormData = () => {
        console.log("Log S.1: Validating sales form data..."); // Sales-specific log prefix

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
         // Basic date format validation for the main bill date (DD-MM-YYYY)
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
             console.log("Log S.6: Validating item:", item); // Debugging log (per item)
            // Validate required fields for each item
            if (!item.product.trim()) {
                 toast.error(`Product name is required for all items.`);
                 console.log(`Log S.7: Validation failed: Missing product name for item:`, item);
                return false;
            }
             // Batch is now required and should be selected/entered
             if (!item.batch.trim()) {
                 toast.error(`Batch No is required for product "${item.product}". Please select a batch or enter manually.`);
                 console.log(`Log S.8: Validation failed: Missing batch for item "${item.product}":`, item);
                 return false;
             }
             // Expiry is now required and should be auto-filled/entered
             if (!item.expiry.trim()) {
                 toast.error(`Expiry Date is required for product "${item.product}". Please select a batch or enter manually.`);
                 console.log(`Log S.9: Validation failed: Missing expiry for item "${item.product}":`, item.expiry);
                 return false;
             }
             // Validate expiry date format (MM-YY) only if it's not empty
             if (item.expiry.trim() && !/^\d{2}-\d{2}$/.test(item.expiry.trim())) { // Updated regex
                toast.error(`Invalid "Expiry Date" format for product "${item.product}". Please use MM-YY.`); // Updated message
                 console.log(`Log S.9.1: Validation failed: Invalid expiry format for item "${item.product}":`, item.expiry);
                return false;
            }
             // Optional: Warn for past dates, but don't block save
             const expiryDateObj = parseMonthYearDate(item.expiry); // Use the MM-YY parser to get a Date object
              if (expiryDateObj) { // Only check date if it parsed successfully
                 const today = new Date();
                  // Compare against the first day of the *next* month after expiry month
                  const nextMonthAfterExpiry = new Date(expiryDateObj.getFullYear(), expiryDateObj.getMonth() + 1, 1);
                 if (nextMonthAfterExpiry < today) {
                      // toast.warning(`Expiry date for "${item.product}" (Batch: ${item.batch}) is in the past.`); // Warning toast already in handleItemChange if auto-filled, or can be here too
                      console.log(`Log S.11: Warning: Expity date in past for item "${item.product}" (Batch: ${item.batch}).`);
                 }
              }


             // Validate numeric fields - quantitySold, pricePerItem, discount
             const quantitySold = Number(item.quantitySold);
             const pricePerItem = Number(item.pricePerItem); // Price per Item (based on MRP/ItemsPerPack)
             const discount = Number(item.discount); // Optional field, validation if entered
             // Removed taxRate validation


             if (item.quantitySold.trim() === '' || isNaN(quantitySold) || quantitySold <= 0) {
                 toast.error(`Invalid "Quantity Sold" for product "${item.product}". Please enter a positive number.`);
                 console.log(`Log S.12: Validation failed: Invalid Quantity Sold for item "${item.product}":`, item.quantitySold);
                 return false;
             }

             // Price per Item must be present and non-negative (now derived from MRP/ItemsPerPack)
             if (item.pricePerItem.trim() === '' || isNaN(pricePerItem) || pricePerItem < 0) {
                 toast.error(`Invalid "Price per Item" for product "${item.product}". Please ensure a valid product is selected.`); // Updated message
                 console.log(`Log S.13: Validation failed: Invalid Price per Item for item "${item.product}":`, item.pricePerItem);
                 return false;
             }

              // Allow empty discount but validate if entered
             if (item.discount.trim() !== '' && (isNaN(discount) || discount < 0 || discount > 100)) {
                  toast.error(`Invalid "Discount (%)" for product "${item.product}". Please enter a number between 0 and 100.`);
                  console.log(`Log S.14: Validation failed: Invalid discount for item "${item.product}":`, item.discount);
                  return false;
             }
             // Removed taxRate validation


             // Basic validation for Unit, Category, Company (expected from Product Master/batch lookup or manual entry)
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

            // --- Stock Availability Check (Simplified - checks total product quantity) ---
            // This check is against the *total* quantity of the product in the Product Master.
            // It does NOT check available stock for the specific BATCH/EXPIRY.
            // For accurate batch-specific stock, you would need a different stock data structure.
            const productInMaster = products.find(p => p.name.toLowerCase() === item.product.trim().toLowerCase());
            if (!productInMaster) {
                toast.error(`Product "${item.product}" not found in Product Master. Cannot sell.`);
                 console.log(`Log S.19: Validation failed: Product "${item.product}" not found in Product Master.`);
                return false; // Cannot sell a product not in master
            }
             const availableStock = Number(productInMaster.quantity) || 0;
             if (quantitySold > availableStock) {
                 toast.error(`Insufficient total stock for "${item.product}". Available: ${availableStock} items.`);
                 console.log(`Log S.20: Validation failed: Insufficient total stock for "${item.product}". Available: ${availableStock}, Attempted: ${quantitySold}`);
                 return false; // Cannot sell more than total available stock for the product
             }


        }
        console.log("Log S.21: Validation successful. All items valid.");
        return true; // Validation passed
    };


    // Function to handle saving a new sales bill or updating an existing one
    const handleSaveOrUpdateBill = () => {
        console.log("Log S.22: handleSaveOrUpdateBill called."); // Sales-specific log prefix
        console.log("Log S.23: Current editingBill state:", editingBill);

        if (!validateFormData()) {
            console.log("Log S.24: Validation failed, stopping save/update.");
            return; // Stop if validation fails (check toasts for details)
        }

        console.log("Log S.25: Validation successful. Proceeding to save/update.");

        // Prepare data for saving/updating
        const salesItemsToSave = salesItems.map(item => ({
            ...item,
             // Ensure numeric fields are stored as numbers after successful validation
             quantitySold: Number(item.quantitySold) || 0,
             pricePerItem: Number(item.pricePerItem) || 0, // Price per Item (based on MRP/ItemsPerPack)
             discount: Number(item.discount) || 0,
             // taxRate: Number(item.taxRate) || 0, // REMOVED taxRate from saving
             totalItemAmount: Number(item.totalItemAmount) || 0,
             // ADDED saving productMrp and productItemsPerPack
             productMrp: Number(item.productMrp) || 0,
             productItemsPerPack: Number(item.productItemsPerPack) || 1,
             // Ensure string fields are trimmed
             product: item.product.trim(),
             batch: item.batch.trim(),
             expiry: item.expiry.trim(), // Expiry is MM-YY string
             unit: item.unit.trim(),
             category: item.category.trim(),
             company: item.company.trim(),
             // Do NOT save availableBatches, it's transient UI state
             availableBatches: undefined,
        }));

        const currentBillData = {
             id: editingBill ? editingBill.id : Date.now() + Math.random(), // Use existing ID if editing, otherwise generate new
            billNumber: billNumber.trim(), // Trim whitespace
            customerName: customerName.trim(), // Trim whitespace
            date: date.trim(), // Use the date as entered (DD-MM-YYYY string)
            items: salesItemsToSave,
            totalAmount: calculateGrandTotal(), // Calculate total based on validated items
        };

        console.log("Log S.26: Prepared sales bill data:", currentBillData);

        // --- Update Stock (Products) - Simplified Stock Tracking ---
        // This updates the *overall* quantity for a product, NOT batch-specific quantity.
        // For proper batch tracking, you'd need to find the specific batch in purchaseBills
        // or a separate stock-by-batch structure and update its quantity there.
        const updatedProducts = products.map(p => ({ ...p })); // Clone Product Master list
        console.log("Log S.27: Cloned products for stock update. Initial count:", updatedProducts.length);
        let stockUpdated = false;
        let stockUpdateErrors = []; // Array to track products that couldn't be updated

        if (editingBill) {
            console.log("Log S.28: Editing mode: Updating existing sales bill stock logic (simplified).");
             // Find the original bill using the editingBill.id
             const originalBill = salesBills.find(bill => bill.id === editingBill.id);
             if (!originalBill) { console.error(`Log S.29: Error (Editing): Original sales bill with ID ${editingBill.id} not found...`); toast.error("Error: Could not find original bill to update stock."); return; }
            console.log("Log S.30: Found original sales bill for editing:", originalBill);

            const originalItems = originalBill.items;
            const editedItems = salesItemsToSave;

            // Create maps for easier lookup by product name (case-insensitive)
            const originalItemsMap = new Map(originalItems.map(item => [item.product.toLowerCase(), item]));
            // No need for editedItemsMap, we iterate salesItemsToSave directly

            console.log("Log S.31: Reverting stock based on original sales items...");
            // Revert stock based on original items (Add back sold quantity)
            originalItemsMap.forEach((originalItem, productNameLower) => {
                // Find the product in the *current* products list (from Product Master)
                const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === productNameLower);

                if (!productToUpdate) {
                    console.warn(`Log S.32: Warning (Editing Revert): Product "${originalItem.product}" from original sales bill not found in current Product Master list. Cannot revert stock.`);
                     stockUpdateErrors.push(`Stock could not be reverted for "${originalItem.product}" (not found in master).`);
                    return; // Cannot revert stock for a deleted product master
                }

                const originalQuantitySold = Number(originalItem.quantitySold) || 0;
                productToUpdate.quantity += originalQuantitySold; // Add back original quantity sold
                stockUpdated = true; // Mark as updated when adding back
                console.log(`Log S.33: Reverted stock for "${originalItem.product}" by adding back ${originalQuantitySold}. Current quantity before re-deducting: ${productToUpdate.quantity}.`);

            });

            console.log("Log S.34: Deducting stock based on edited sales items...");
            // Deduct stock based on edited items (Subtract new quantity sold)
             salesItemsToSave.forEach(editedItem => { // Iterate through the items being saved
                 const productNameLower = editedItem.product.toLowerCase();
                 const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === productNameLower);

                 if (!productToUpdate) {
                      console.warn(`Log S.35: Warning (Editing Deduct): Product "${editedItem.product}" from edited sales bill not found in current Product Master list. Cannot deduct stock.`);
                      stockUpdateErrors.push(`Stock could not be deducted for "${editedItem.product}" (not found in master).`);
                      toast.warning(`Product "${editedItem.product}" not found in Product Master. Stock was not updated.`); // Show toast immediately
                      return; // Skip stock update for this item
                 }

                 const editedQuantitySold = Number(editedItem.quantitySold) || 0;
                 // Check if there's enough stock *after* reverting original sale and before deducting the new quantity
                 // This is a simplified check based on total quantity, not batch-specific
                 // We already reverted the original quantity, so we check against the current quantity in updatedProducts
                 if (productToUpdate.quantity < editedQuantitySold) { // Check if available stock is less than the new quantity being sold
                      console.error(`Log S.36: Error (Editing Deduct): Insufficient stock for "${editedItem.product}". Available: ${productToUpdate.quantity}, Needed for new sale: ${editedQuantitySold}`);
                      stockUpdateErrors.push(`Insufficient stock for "${editedItem.product}" to complete update.`);
                      toast.error(`Insufficient stock for "${editedItem.product}" to update bill.`);
                      // Decide how to handle this - maybe prevent saving the bill?
                      // For now, we'll log the error and add to errors list, but allow bill save.
                      return; // Skip stock deduction for this item if insufficient stock
                 }


                 productToUpdate.quantity -= editedQuantitySold; // Subtract new quantity sold
                 stockUpdated = true; // Mark as updated if at least one product was found and modified
                 console.log(`Log S.37: Deducted stock for "${editedItem.product}" by ${editedQuantitySold}. New quantity: ${productToUpdate.quantity}`);
             });


             // Ensure quantity doesn't go below zero for any product after adjustments
             updatedProducts.forEach(p => {
                 if (p.quantity < 0) {
                      console.warn(`Log S.38: Warning: Product "${p.name}" quantity went below zero after update. Setting to 0.`);
                      p.quantity = 0;
                 }
             });
             console.log("Log S.39: Finished stock update logic for editing sales bill.");


        } else { // --- Logic for Deducting Stock for a New Sales Bill ---
            console.log("Log S.40: Adding mode: Deducting stock for new sales bill logic.");

            // Check for duplicate bill number before adding (optional but good practice)
             if (salesBills.some(bill => bill.billNumber.toLowerCase() === currentBillData.billNumber.toLowerCase())) {
                 console.error("Log S.41: Error (Add): Sales bill number already exists.", currentBillData.billNumber);
                 toast.error(`Bill number "${currentBillData.billNumber}" already exists.`);
                 return; // Stop the save
             }
            console.log("Log S.42: Sales bill number is unique. Proceeding with stock deduction for new bill.");


            salesItemsToSave.forEach(item => { // Iterate through the items being saved
                // Find the product in the *current* products list (from Product Master)
                // Use case-insensitive match
                const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === item.product.toLowerCase());

                if (productToUpdate) {
                    const quantitySold = Number(item.quantitySold) || 0;
                    // Check if there's enough stock before deducting (simplified - checks total quantity)
                     const availableStock = Number(productToUpdate.quantity) || 0;
                     if (quantitySold > availableStock) {
                         console.error(`Log S.43: Error (Add Deduct): Insufficient stock for "${item.product}". Available: ${availableStock}, Attempted: ${quantitySold}`);
                         stockUpdateErrors.push(`Insufficient stock for "${item.product}". Available: ${availableStock}, Attempted: ${quantitySold}`);
                         toast.error(`Insufficient stock for "${item.product}". Available: ${availableStock} items.`); // Show toast immediately
                         // Decide how to handle this - maybe prevent saving the bill?
                         // For now, we'll log the error and add to errors list, but allow bill save.
                         return; // Skip stock deduction for this item if insufficient stock
                     }


                    // Deduct the sold quantity from stock
                     productToUpdate.quantity = Number(productToUpdate.quantity) - quantitySold; // Ensure existing quantity is number
                    console.log(`Log S.44: Deducted quantity for existing product "${item.product}". New quantity: ${productToUpdate.quantity}.`);
                    stockUpdated = true; // Mark as updated if at least one product was found and modified
                } else {
                     // Product not found in Product Master.
                     console.warn(`Log S.45: Warning (Add): Product "${item.product}" not found in Product Master when saving new sales bill. Stock will not be updated for this item.`);
                     stockUpdateErrors.push(`Stock could not be updated for "${item.product}" (not found in master).`);
                     toast.warning(`Product "${item.product}" not found in Product Master. Stock for this item was not updated.`); // Show toast immediately
                }
            });

            // Ensure quantity doesn't go below zero after deductions
             updatedProducts.forEach(p => {
                 if (p.quantity < 0) {
                      console.warn(`Log S.46: Warning: Product "${p.name}" quantity went below zero unexpectedly after deductions. Setting to 0.`);
                      p.quantity = 0;
                 }
             });
             console.log("Log S.47: Finished stock deduction logic for new sales bill.");

        }

         // --- Save Updated Products to Local Storage and State ---
         // Only save/update products if stock was actually adjusted or if there were warnings/errors
         if (stockUpdated || stockUpdateErrors.length > 0) {
             console.log("Log S.48: Stock changes detected or errors occurred. Attempting to save updated products to localStorage.");
             try {
                 localStorage.setItem('products', JSON.stringify(updatedProducts));
                 setProducts(updatedProducts); // Update component state
                 console.log("Log S.49: Updated products saved to localStorage and state.");
                 // Dispatch event AFTER updating state and localStorage
                 window.dispatchEvent(new Event('productsUpdated'));
                 console.log("Log S.50: Dispatched 'productsUpdated' event.");

                 // Report any stock update errors *after* saving the best possible state
                 if (stockUpdateErrors.length > 0) {
                     const errorMsg = "Stock update issues: " + stockUpdateErrors.join("; ");
                     console.error("Log S.51: Stock update errors summary:", errorMsg);
                     // toast.error(errorMsg); // Decide if you want a single large error toast
                 }

             } catch (lsErrorProducts) {
                 console.error("Log S.52: Error (Products Save): Error saving products to localStorage:", lsErrorProducts);
                 toast.error("Error saving product stock data after sale. Local storage might be full.");
                 // Decide if you want to stop here or try to save the bill anyway
                 // If stock update failed, saving the bill might lead to inconsistencies
             }
         } else {
             console.log("Log S.53: No stock updated (no items found in Product Master or no quantity changes). Skipping products localStorage save.");
         }


        // --- Save or Update the Sales Bill ---
        let updatedSalesBills;
        let successMessage = '';
        let billSaveError = false; // Flag to check if bill save fails

        if (editingBill) {
            console.log("Log S.54: Attempting to update existing sales bill...");
            // Replace the original bill with the updated one
            updatedSalesBills = salesBills.map(bill =>
                bill.id === currentBillData.id ? currentBillData : bill
            );
            successMessage = `Sales Bill ${currentBillData.billNumber} updated successfully!`;
            console.log("Log S.55: Sales bill updated in memory list.", updatedSalesBills);

        } else { // Adding a new bill
             console.log("Log S.56: Attempting to add new sales bill...");
            // The duplicate bill number check for ADD mode is done earlier (Log S.41)
            // Add the new bill to the list
            updatedSalesBills = [...salesBills, currentBillData];
            successMessage = `Sales Bill ${currentBillData.billNumber} saved successfully!`;
            console.log("Log S.57: New sales bill added to memory list.", updatedSalesBills);
             // Add customer name to local storage if it's new (basic)
             const existingCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
             const customerNameTrimmed = customerName.trim();
             // Assuming customers are stored as an array of strings, check if the trimmed name exists (case-insensitive)
             if(customerNameTrimmed && !existingCustomers.some(existingName => existingName.toLowerCase() === customerNameTrimmed.toLowerCase())){
                 const newCustomers = [...existingCustomers, customerNameTrimmed];
                 localStorage.setItem('customers', JSON.stringify(newCustomers));
                 setCustomers(newCustomers); // Update state
                 console.log(`Added new customer "${customerNameTrimmed}" to localStorage.`);
             }
        }

        // --- Save Updated Sales Bills to Local Storage and State ---
        console.log("Log S.58: Attempting to save updated sales bills to localStorage.");
         try {
             localStorage.setItem('salesBills', JSON.stringify(updatedSalesBills)); // Save to 'salesBills'
             setSalesBills(updatedSalesBills); // Update component state with the new/updated bills list
             setFilteredSalesBills(updatedSalesBills); // Also update filtered list
             console.log("Log S.59: Updated sales bills saved to localStorage and state.");

             toast.success(successMessage);
             console.log("Log S.60: Success toast shown.");

             // Reset form or close dialog after successful save/update
             if (editingBill) {
                 console.log("Log S.61: Resetting editing state and closing dialog.");
                 setIsEditDialogOpen(false);
                 setEditingBill(null);
                 resetForm(); // Reset form state even after successful update
             } else {
                 console.log("Log S.62: Resetting form.");
                 resetForm(); // Reset the form after successfully saving a new bill
             }

         } catch (lsErrorBills) {
             console.error("Log S.63: Error (Bill Save): Error saving sales bills to localStorage:", lsErrorBills);
             toast.error("Error saving sales bill data. Local storage might be full.");
             billSaveError = true;

             // Important: If saving bills failed *after* stock was updated successfully,
             // you have an inconsistency (stock updated, but bill not saved).
             // You might need logic here to attempt to revert the stock update if the bill cannot be saved.
             // For now, this logs the error and shows a toast.
         }

         // Final log after trying to save bills
         console.log("Log S.64: handleSaveOrUpdateBill finished.");

         // Optional: Add a final summary toast if there were errors during the process
         if (stockUpdateErrors.length > 0 || billSaveError) {
              // Decide if a summary toast is better than individual warnings/errors
         }
    };

    // Function to reset the form to initial state (for new entry)
    const resetForm = () => {
         console.log("Resetting sales form state.");
        setBillNumber('');
        setCustomerName('');
        setDate(formatDate(new Date())); // Reset date to today
        // Reset salesItems to a single, empty row
        setSalesItems([{ product: '', quantitySold: '', batch: '', expiry: '', pricePerItem: '', discount: '', unit: '', category: '', company: '', totalItemAmount: '', availableBatches: [], productMrp: '', productItemsPerPack: '' }]); // NO taxRate
        setEditingBill(null); // Ensure editing state is off
        setIsEditDialogOpen(false); // Ensure edit dialog is closed
    };

    // Function to start editing a sales bill
    const handleEditBill = (bill) => {
         console.log("Initiating edit for sales bill:", bill.billNumber);
        setEditingBill(bill);
        // Populate the form and items state with the bill data
        setBillNumber(bill.billNumber || '');
        setCustomerName(bill.customerName || '');
        setDate(bill.date || formatDate(new Date())); // Date should be DD-MM-YYYY string, default to today if missing
        // Populate salesItems state with bill items, converting numbers back to strings for inputs
        setSalesItems(bill.items.map(item => {
             // When editing, re-populate availableBatches for each item based on its product
             const itemProductNameLower = item.product ? item.product.toLowerCase() : '';
             const availableBatchesForEdit = [];
              const seenBatchesForEdit = new Set(); // Use Set to ensure unique batches based on batch number and expiry

              if (itemProductNameLower) {
                  purchaseBills.forEach(purchaseBill => {
                      purchaseBill.items.forEach(purchaseItem => {
                          // Match product name (case-insensitive) AND check if batch/expiry are present
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
                 quantitySold: String(item.quantitySold ?? '') || '', // Use ?? '' to handle null/undefined gracefully
                 pricePerItem: String(item.pricePerItem ?? '') || '', // pricePerItem saved with the bill item (was based on MRP/ItemsPerPack)
                 discount: String(item.discount ?? '') || '',
                 // taxRate: String(item.taxRate ?? '') || '', // REMOVED taxRate from populating
                 totalItemAmount: Number(item.totalItemAmount) || 0, // Keep total as number
                 productMrp: String(item.productMrp ?? '') || '', // Populate saved MRP
                 productItemsPerPack: String(item.productItemsPerPack ?? '') || '', // Populate saved Items/Pack
                 product: item.product || '',
                 batch: item.batch || '', // Batch should be present in sales item
                 expiry: item.expiry || '', // Expiry should be present in sales item (MM-YY string)
                 unit: item.unit || '',
                 category: item.category || '',
                 company: item.company || '',
                 availableBatches: availableBatchesForEdit, // Populate available batches for this item in edit mode
            };
        }));
        setIsEditDialogOpen(true); // Open the edit dialog (assuming you use a dialog for editing)
        setSelectedBillDetails(null); // Close view dialog if open
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
                 // Proceed with bill deletion even if stock cannot be reverted to avoid orphaned bills
            } else {
                 console.log("Found sales bill to delete. Reverting stock changes...");
                 const updatedProducts = products.map(p => ({ ...p })); // Clone products for modification
                 let stockReverted = false;
                 let stockRevertErrors = [];

                 billToDelete.items.forEach(item => {
                      // Find the product in the *current* products list (from Product Master)
                      const productToUpdate = updatedProducts.find(p => p.name.toLowerCase() === item.product.toLowerCase());

                      if (!productToUpdate) {
                          console.warn(`Warning (Delete Revert): Product "${item.product}" from deleted sales bill not found in current Product Master list. Cannot revert stock.`);
                          stockRevertErrors.push(`Stock could not be reverted for "${item.product}" (not found in master).`);
                          return; // Cannot revert stock if product master doesn't exist anymore
                      }

                      const deletedQuantitySold = Number(item.quantitySold) || 0;
                      productToUpdate.quantity += deletedQuantitySold; // Add back the quantity sold
                      stockReverted = true; // Mark as reverted if at least one product was found and modified
                      console.log(`Reverted stock for "${item.product}" by adding back ${deletedQuantitySold}. New quantity: ${productToUpdate.quantity}`);
                 });

                 // Ensure quantity doesn't go below zero after adjustments
                 updatedProducts.forEach(p => {
                     if (p.quantity < 0) {
                          console.warn(`Warning: Product "${p.name}" quantity went below zero after deletion reversion. Setting to 0.`);
                          p.quantity = 0;
                     }
                 });

                 // --- Save Updated Products ---
                 if (stockReverted || stockRevertErrors.length > 0) {
                     console.log("Stock reverted or errors occurred during revert. Attempting to save updated products.");
                     try {
                         localStorage.setItem('products', JSON.stringify(updatedProducts));
                         setProducts(updatedProducts); // Update component state
                         window.dispatchEvent(new Event('productsUpdated')); // Notify other components
                         console.log("Updated products saved after sales bill deletion and event dispatched.");

                         if (stockRevertErrors.length > 0) {
                              const errorMsg = "Stock reversion issues during deletion: " + stockRevertErrors.join("; ");
                              console.error("Stock reversion errors summary:", errorMsg);
                              // toast.error(errorMsg); // Optional: single summary error toast
                         }

                     } catch (lsErrorRevert) {
                         console.error("Error (Products Save Revert): Error saving products after sales bill deletion:", lsErrorRevert);
                         toast.error("Error saving product stock data after sales bill deletion. Stock might be inconsistent.");
                     }
                 } else {
                      console.log("No stock reverted (no items found in Product Master). Skipping products localStorage save.");
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

                 toast.success(`Sales Bill ${billNumber} deleted.`); // Show success toast AFTER deletion
                 console.log("Sales bill deletion success toast shown.");

                 // If the deleted bill was being edited or viewed, close the dialogs and reset states
                 if (editingBill && editingBill.id === billId) {
                      console.log("Deleted sales bill was being edited. Resetting form.");
                      resetForm(); // This also resets editing state
                 }
                 if (selectedBillDetails && selectedBillDetails.id === billId) {
                      console.log("Deleted sales bill was being viewed. Closing view dialog.");
                      setSelectedBillDetails(null);
                      setIsViewDialogOpen(false);
                 }
            } catch (lsErrorDeleteBill) {
                 console.error("Log S.65 (Delete Bill): Error deleting sales bill from localStorage:", lsErrorDeleteBill);
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
        setIsEditDialogOpen(false); // Close edit dialog if open
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
        resetForm(); // Reset the form state when closing edit dialog without saving
    };


    // Get product suggestions based on user input for datalist
    const getProductSuggestions = (inputValue) => {
        const query = inputValue.toLowerCase();
        // Limit suggestions for performance with many products
        return products
               .filter(product => product.name.toLowerCase().includes(query))
               .map(product => product.name)
               .slice(0, 20); // Limit to first 20 suggestions
    };

     // Get customer suggestions based on user input for datalist (using the loaded customers state)
     const getCustomerSuggestions = (inputValue) => {
         const query = inputValue.toLowerCase();
         // Assuming customers are stored as an array of strings
         return customers
                .filter(customer => customer.toLowerCase().includes(query))
                .slice(0, 20); // Limit suggestions
     };


    // Render logic starts here
    return (
        <div>
            <Header />
            <div className="container mx-auto p-6 bg-white shadow-md rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">{editingBill ? 'Edit Sales Bill' : 'New Sales Entry'}</h2>
                    <Button onClick={() => router.push("/")} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">Go to Dashboard</Button>
                </div>

                {/* Sales Bill Form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Bill/Invoice Number (Required)"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                        className="border p-2 rounded"
                        required
                    />
                    <input
                        type="text"
                        placeholder="Customer Name (Required)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="border p-2 rounded"
                         list="customer-suggestions" // Add datalist for customer suggestions
                        required
                    />
                     {/* Datalist for Customer Suggestions */}
                     <datalist id="customer-suggestions">
                         {getCustomerSuggestions(customerName).map((customer, index) => (
                             <option key={index} value={customer} />
                         ))}
                     </datalist>

                    <input
                        type="text" // Using text allows DD-MM-YYYY format input
                        placeholder="Bill Date (DD-MM-YYYY)"
                        value={date}
                        onChange={handleDateChange}
                        className="border p-2 rounded"
                        required
                        // Consider adding pattern validation or using type="date"
                    />
                </div>

                {/* Sales Items Table */}
                <h3 className="text-xl font-semibold mb-2">Sales Items</h3>
                 <div className="overflow-x-auto mb-4">
                     <table className="w-full table-auto border-collapse border border-gray-300">
                         <thead>
                             <tr className="bg-gray-100 text-left text-sm">
                                 <th className="border border-gray-300 px-2 py-2 w-1/5">Product (Req.)</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[10%]">Batch No. (Req.)</th> {/* Moved Batch */}
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Expiry (MM-YY) (Req.)</th> {/* Moved Expiry */}
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Quantity (Items) (Req.)</th> {/* Moved Quantity */}
                                  {/* ADDED MRP and Items/Pack Headers */}
                                  <th className="border border-gray-300 px-2 py-2 w-[8%]">MRP</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Items/Pack</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Price/Item (Req. ≥0)</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Discount (%)</th>
                                 {/* REMOVED Tax Rate Header */}
                                  {/* Display Unit, Category, Company - Required but pre-filled/validated*/}
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Unit</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Category</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[8%]">Company</th>
                                 <th className="border border-gray-300 px-2 py-2 w-[10%]">Item Total</th>
                                 {/* Total columns: 12 */}
                                 <th className="border border-gray-300 px-2 py-2 w-[5%] text-center">Actions</th>
                             </tr>
                         </thead>
                         <tbody>
                             {salesItems.map((item, index) => (
                                 <tr key={index} className="hover:bg-gray-50">
                                     <td className="border border-gray-300 px-2 py-1">
                                         <input
                                             type="text"
                                             value={item.product}
                                             onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                                             className="w-full p-1 border rounded text-sm"
                                             list={`product-suggestions-${index}`} // Unique datalist id per row
                                             required
                                         />
                                         {/* Datalist for Product Suggestions */}
                                         <datalist id={`product-suggestions-${index}`}>
                                             {getProductSuggestions(item.product).map((productName, i) => (
                                                 <option key={i} value={productName} />
                                             ))}
                                         </datalist>
                                     </td>
                                     <td className="border border-gray-300 px-2 py-1"> {/* Batch Input with Datalist */}
                                         <input
                                             type="text"
                                             placeholder="Batch No."
                                             value={item.batch}
                                             onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                                             className="w-full p-1 border rounded text-sm"
                                             list={`batch-suggestions-${index}`} // Link to datalist
                                             required
                                         />
                                         {/* Datalist for Batch Suggestions (Populated when product is selected) */}
                                         <datalist id={`batch-suggestions-${index}`}>
                                             {/* Iterate through availableBatches stored in the item's state */}
                                             {item.availableBatches.map((batchDetail, i) => (
                                                 // Use batchDetail.display for the datalist option value
                                                 <option key={i} value={batchDetail.display} />
                                             ))}
                                         </datalist>
                                     </td>
                                     <td className="border border-gray-300 px-2 py-1"> {/* Expiry Input (Auto-filled) */}
                                         <input
                                             type="text"
                                             placeholder="MM-YY"
                                             value={item.expiry} // Value is auto-filled when batch is selected
                                              // onChange={(e) => handleItemChange(index, 'expiry', e.target.value)} // Keep handler in case manual edit is needed
                                             className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed" // Indicate auto-filled/read-only appearance
                                             readOnly // Make read-only as it's auto-filled
                                             disabled // Visually disable
                                             required
                                             // Consider adding pattern="[0-1][0-9]-[0-9]{2}" for HTML5 validation hint
                                         />
                                     </td>
                                      <td className="border border-gray-300 px-2 py-1"> {/* Quantity Input (Moved) */}
                                          <input
                                              type="number"
                                              placeholder="Items"
                                              value={item.quantitySold}
                                              onChange={(e) => handleItemChange(index, 'quantitySold', e.target.value)}
                                              className="w-full p-1 border rounded text-sm"
                                              min="0" // Allow 0? Validation requires > 0
                                              required
                                          />
                                      </td>
                                      {/* ADDED MRP Input (Read-only) */}
                                      <td className="border border-gray-300 px-2 py-1">
                                          <input
                                              type="text" // Use text for display
                                              placeholder="MRP"
                                              value={item.productMrp} // Value comes from Product Master lookup
                                              className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed"
                                               readOnly disabled
                                          />
                                      </td>
                                       {/* ADDED Items/Pack Input (Read-only) */}
                                       <td className="border border-gray-300 px-2 py-1">
                                           <input
                                               type="text" // Use text for display
                                               placeholder="Items/Pack"
                                               value={item.productItemsPerPack} // Value comes from Product Master lookup
                                               className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed"
                                               readOnly disabled
                                           />
                                       </td>

                                      <td className="border border-gray-300 px-2 py-1">
                                          <input
                                              type="number"
                                              placeholder="Price/Item"
                                              value={item.pricePerItem} // Value is now the Product Master's MRP / ItemsPerPack
                                              onChange={(e) => handleItemChange(index, 'pricePerItem', e.target.value)} // Keep handler in case manual override is needed
                                              className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed" // Indicate derived/read-only appearance
                                               readOnly // Make read-only as it's auto-derived from MRP/ItemsPerPack
                                               disabled // Visually disable
                                              min="0"
                                              step="0.01"
                                              required
                                          />
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1">
                                          <input
                                              type="number"
                                              value={item.discount}
                                              onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                                              className="w-full p-1 border rounded text-sm"
                                              min="0"
                                              max="100"
                                          />
                                      </td>
                                       {/* REMOVED Tax Rate Input */}
                                      {/* Display Unit, Category, Company (read-only) - Expected from Master/batch */}
                                     <td className="border border-gray-300 px-2 py-1">
                                         <input
                                             type="text"
                                             value={item.unit}
                                              onChange={(e) => handleItemChange(index, 'unit', e.target.value)} // Keep handler in case manual entry is needed
                                             className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed"
                                             readOnly disabled
                                             required // Mark as required for validation purposes
                                         />
                                     </td>
                                     <td className="border border-gray-300 px-2 py-1">
                                          <input
                                              type="text"
                                              value={item.category}
                                               onChange={(e) => handleItemChange(index, 'category', e.target.value)} // Keep handler
                                              className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed"
                                              readOnly disabled
                                              required // Mark as required for validation purposes
                                          />
                                      </td>
                                      <td className="border border-gray-300 px-2 py-1">
                                          <input
                                              type="text"
                                              value={item.company}
                                               onChange={(e) => handleItemChange(index, 'company', e.target.value)} // Keep handler
                                              className="w-full p-1 border rounded text-sm bg-gray-100 cursor-not-allowed"
                                              readOnly disabled
                                              required // Mark as required for validation purposes
                                          />
                                      </td>
                                     <td className="border border-gray-300 px-2 py-1 font-semibold">
                                         ₹{(Number(item.totalItemAmount) || 0).toFixed(2)} {/* Display calculated total */}
                                     </td>
                                     <td className="border border-gray-300 px-2 py-1 text-center">
                                         {salesItems.length > 1 && (
                                             <Button variant="destructive" size="sm" onClick={() => removeItem(index)} className="bg-red-600 hover:bg-red-700 text-white p-1"><X className="h-4 w-4" /></Button>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>


                {/* Add Item Button */}
                <Button onClick={addItem} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-6">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>

                {/* Grand Total */}
                <div className="flex justify-end mb-6">
                    <div className="text-lg font-semibold">
                        Grand Total: ₹{calculateGrandTotal().toFixed(2)}
                    </div>
                </div>

                {/* Save/Update and Cancel Buttons */}
                <div className="flex justify-start space-x-2 mb-6">
                    <Button onClick={handleSaveOrUpdateBill} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                        {editingBill ? 'Update Bill' : 'Save Bill'}
                    </Button>
                    {editingBill && (
                        <Button onClick={handleCloseEditDialog} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">
                            Cancel Edit
                        </Button>
                    )}
                     {!editingBill && ( // Show Reset button only when adding new bill
                         <Button onClick={resetForm} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">
                             Reset Form
                         </Button>
                     )}
                </div>

                <hr className="my-6" />

                {/* Sales Bill List Section */}
                <h3 className="text-xl font-semibold mb-2">Sales Bill History</h3>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search by Bill No, Customer, or Date"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="border p-2 rounded w-full md:w-1/3"
                    />
                </div>

                 <div className="overflow-x-auto">
                     <table className="w-full table-auto border-collapse border border-gray-300">
                         <thead>
                             <tr className="bg-gray-100 text-left text-sm">
                                 <th className="border border-gray-300 px-4 py-2">Bill No</th>
                                 <th className="border border-gray-300 px-4 py-2">Customer</th>
                                 <th className="border border-gray-300 px-4 py-2">Date</th>
                                 <th className="border border-gray-300 px-4 py-2">Total Amount</th>
                                 <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                             </tr>
                         </thead>
                         <tbody>
                             {filteredSalesBills.length > 0 ? (
                                 filteredSalesBills.map((bill) => (
                                     <tr key={bill.id} className="hover:bg-gray-50">
                                         <td className="border border-gray-300 px-4 py-2">{bill.billNumber}</td>
                                         <td className="border border-gray-300 px-4 py-2">{bill.customerName}</td>
                                         <td className="border border-gray-300 px-4 py-2">{bill.date}</td>
                                         <td className="border border-gray-300 px-4 py-2">₹{Number(bill.totalAmount).toFixed(2)}</td>
                                         <td className="border border-gray-300 px-4 py-2 text-center">
                                             <div className="flex justify-center space-x-2">
                                                 <Button variant="outline" size="sm" onClick={() => handleViewBill(bill)} className="text-blue-600 hover:text-blue-800 p-1"><Eye className="h-4 w-4" /></Button>
                                                 <Button variant="outline" size="sm" onClick={() => handleEditBill(bill)} className="text-yellow-600 hover:text-yellow-800 p-1"><Edit className="h-4 w-4" /></Button>
                                                 <Button variant="destructive" size="sm" onClick={() => handleDeleteBill(bill.id, bill.billNumber)} className="bg-red-600 hover:bg-red-700 text-white p-1"><Trash2 className="h-4 w-4" /></Button>
                                             </div>
                                         </td>
                                     </tr>
                                 ))
                             ) : (
                                 <tr>
                                     <td colSpan="5" className="border border-gray-300 px-4 py-2 text-center">No sales bills found</td>
                                 </tr>
                             )}
                         </tbody>
                     </table>
                 </div>


                 {/* View Bill Dialog (Simplified) */}
                 {isViewDialogOpen && selectedBillDetails && (
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                         <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                             <div className="flex justify-between items-center mb-4">
                                 <h3 className="text-xl font-semibold">Sales Bill Details: {selectedBillDetails.billNumber}</h3>
                                 <Button size="sm" onClick={handleCloseViewDialog} className="bg-gray-300 hover:bg-gray-400 text-gray-800 p-1 rounded-full"><X className="h-4 w-4" /></Button>
                             </div>
                             <p><strong>Customer:</strong> {selectedBillDetails.customerName}</p>
                             <p><strong>Date:</strong> {selectedBillDetails.date}</p>
                             <h4 className="font-semibold mt-4 mb-2">Items:</h4>
                             <div className="overflow-x-auto">
                                <table className="w-full table-auto border-collapse border border-gray-300 text-sm">
                                    <thead>
                                         <tr className="bg-gray-100 text-left">
                                             <th className="border border-gray-300 px-2 py-1">Product</th>
                                             <th className="border border-gray-300 px-2 py-1">Quantity (Items)</th>
                                             <th className="border border-gray-300 px-2 py-1">Batch</th>
                                             <th className="border border-gray-300 px-2 py-1">Expiry (MM-YY)</th>
                                             {/* ADDED MRP and Items/Pack Headers */}
                                             <th className="border border-gray-300 px-2 py-1">MRP</th>
                                             <th className="border border-gray-300 px-2 py-1">Items/Pack</th>
                                             <th className="border border-gray-300 px-2 py-1">Price/Item</th>
                                             <th className="border border-gray-300 px-2 py-1">Discount (%)</th>
                                             {/* REMOVED Tax Rate Header */}
                                             {/* <th className="border border-gray-300 px-2 py-1">Tax Rate (%)</th> */}
                                             <th className="border border-gray-300 px-2 py-1">Unit</th>
                                             <th className="border border-gray-300 px-2 py-1">Category</th>
                                             <th className="border border-gray-300 px-2 py-1">Company</th>
                                             <th className="border border-gray-300 px-2 py-1">Item Total</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {selectedBillDetails.items.map((item, itemIndex) => (
                                             <tr key={itemIndex}>
                                                  <td className="border border-gray-300 px-2 py-1">{item.product}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.quantitySold}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.batch}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.expiry}</td>
                                                   {/* ADDED MRP and Items/Pack Data */}
                                                   <td className="border border-gray-300 px-2 py-1">{item.productMrp ? `₹${Number(item.productMrp).toFixed(2)}` : '-'}</td> {/* Display saved MRP */}
                                                  <td className="border border-gray-300 px-2 py-1">{item.productItemsPerPack || '-'}</td> {/* Display saved Items/Pack */}
                                                  <td className="border border-gray-300 px-2 py-1">₹{Number(item.pricePerItem).toFixed(2)}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.discount}%</td>
                                                   {/* REMOVED Tax Rate Data */}
                                                   {/* <td className="border border-gray-300 px-2 py-1">{item.taxRate}%</td> */}
                                                  <td className="border border-gray-300 px-2 py-1">{item.unit}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.category}</td>
                                                  <td className="border border-gray-300 px-2 py-1">{item.company}</td>
                                                  <td className="border border-gray-300 px-2 py-1 font-semibold">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                             <p className="text-lg font-semibold mt-4 text-right">Grand Total: ₹{Number(selectedBillDetails.totalAmount).toFixed(2)}</p>
                              <div className="flex justify-end mt-4">
                                   <Button onClick={handleCloseViewDialog} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">Close</Button>
                              </div>
                          </div>
                     </div>
                 )}

                 {/* Edit Bill Dialog - Uses the main form state and inputs (Simplified) */}
                 {/* The main form area is used for editing when editingBill state is not null */}


            </div> {/* Closes the main container div */}
        </div> 
    );
};

export default SalesPage;