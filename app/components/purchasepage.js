// app/purchase/page.js
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Import useRef
import { Button } from '../components/button'; // Adjust path if needed
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path if needed
import { toast } from 'sonner'; // Assuming sonner is installed for notifications
import { Plus, Trash2 } from 'lucide-react'; // Keep icons needed for the bill form

// Import the new reusable component (assuming it's still needed for other functionality)
import ProductSearchAndDetails from '../components/ProductSearchAndDetails'; // Adjust path if needed

// Helper function to format date as DD-MM-YYYY
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// You likely still need parseDate if you display saved bill dates formatted
function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null;
    }
    const [day, month, year] = dateString.split('-');
     if (day && month && year && !isNaN(parseInt(day, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(year, 10))) {
         const dayInt = parseInt(day, 10);
         const monthInt = parseInt(month, 10);
         const yearInt = parseInt(year, 10);
         if (dayInt >= 1 && dayInt <= 31 && monthInt >= 1 && monthInt <= 12 && yearInt >= 1900 && yearInt <= 2100) {
             return new Date(yearInt, monthInt - 1, dayInt);
         }
     }
    return null;
}

// Helper function to calculate profit and margin for an item (based on PACKS and applied discount)
const calculateProfitAndMargin = (quantityItems, ptrPerPack, itemsPerPack, mrpPerPack, discount) => {
    const quantityItemsNum = Number(quantityItems);
    const ptrPerPackNum = Number(ptrPerPack); // Price to Retailer per PACK
    const itemsPerPackNum = Number(itemsPerPack);
    const mrpPerPackNum = Number(mrpPerPack); // Maximum Retail Price per PACK
    const discountNum = Number(discount); // Discount percentage

    // Ensure inputs are valid numbers and itemsPerPack is not zero
    if (isNaN(quantityItemsNum) || quantityItemsNum <= 0 || isNaN(ptrPerPackNum) || ptrPerPackNum < 0 || isNaN(itemsPerPackNum) || itemsPerPackNum <= 0 || isNaN(mrpPerPackNum) || mrpPerPackNum <= 0 || isNaN(discountNum) || discountNum < 0) {
        return { profitPerPack: null, totalProfit: null, margin: null, totalItemAmount: null };
    }

    // Calculate the number of packs purchased (can be a decimal)
    const numberOfPacks = quantityItemsNum / itemsPerPackNum;

    // Calculate the cost for the total quantity of packs purchased (based on PTR)
    const totalCostBasedOnPtr = ptrPerPackNum * numberOfPacks;

    // Calculate the total amount paid for this item line AFTER discount
    // Discount is applied to the PTR-based total cost
    const totalAmountPaid = totalCostBasedOnPtr * (1 - discountNum / 100);


    // Calculate the potential total revenue if all items are sold at full MRP per pack
    const totalPotentialRevenueAtMrp = mrpPerPackNum * numberOfPacks;

    // Calculate the Total Profit based on potential revenue vs actual cost paid
    const totalProfit = totalPotentialRevenueAtMrp - totalAmountPaid;

    // Calculate Profit per Pack based on the total profit (will be profit for the fractional pack if applicable)
    const profitPerPack = totalProfit / numberOfPacks;


    // Calculate margin based on the Total Profit relative to the Total Potential Revenue at MRP
    // Margin % = (Total Profit / Total Potential Revenue at MRP) * 100
     let margin = null;
     if (totalPotentialRevenueAtMrp > 0) {
         margin = (totalProfit / totalPotentialRevenueAtMrp) * 100;
     }


    return {
        profitPerPack: profitPerPack, // Profit per single pack (based on actual cost)
        totalProfit: totalProfit, // Total profit for this line (based on actual cost)
        margin: margin, // Margin percentage based on total profit vs total MRP revenue
        totalItemAmount: totalAmountPaid, // Total amount paid after discount
    };
};


const PurchasePage = () => {
    const router = useRouter();

    // State for the current purchase bill being created
    const [currentBill, setCurrentBill] = useState({
        id: null,
        billNumber: '',
        date: formatDate(new Date()), // Default to today's date
        supplierName: '',
        items: [], // Array of items in the current bill
        totalAmount: 0, // Calculated total amount for the bill
    });

    // State for the form to add a new item to the current bill
    const [itemForm, setItemForm] = useState({
        id: null, // Unique ID for the item within the bill
        product: '', // Product Name
        batch: '',
        expiry: '', // MM-YY format
        quantity: '', // Number of items purchased (total items in batch/box)
        ptr: '', // Price to Retailer (per pack)
        itemsPerPack: '', // Items per pack for this specific purchase entry
        // Fields to store from product master or calculate
        unit: '',
        mrp: '', // MRP per PACK (can be adjusted - this is the ENTERED MRP)
        originalMrp: '', // Store the original MRP from product master
        discount: '', // Make this editable
        taxRate: '', // Tax rate from master (if needed, though not used in profit calc here)
        totalItemAmount: 0, // Calculated total for this item line (after discount)
        calculatedProfitPerPack: null, // Calculated profit per single pack
        calculatedTotalProfit: null, // Calculated total profit for this item line
        calculatedMargin: null, // Calculated margin percentage for this item line
    });

    // State for saved purchase bills
    const [purchaseBills, setPurchaseBills] = useState([]);
    // State for product master data (needed for the item form product suggestion and detail lookup)
    const [products, setProducts] = useState([]);

    // Ref to store the original MRP when a product is selected, for comparison later
    const originalMrpRef = useRef('');


    // --- Data Loading from localStorage ---
    useEffect(() => {
        const loadData = () => {
            // Load products (needed for the item form's product dropdown)
            const storedProducts = localStorage.getItem('products');
            if (storedProducts) {
                try {
                    setProducts(JSON.parse(storedProducts));
                } catch (error) {
                    console.error("Error loading products from localStorage:", error);
                    setProducts([]);
                }
            } else {
                 setProducts([]);
            }

            // Load purchase bills (needed if you want to display a list of past bills)
            const storedBills = localStorage.getItem('purchaseBills');
            if (storedBills) {
                try {
                    const parsedBills = JSON.parse(storedBills);
                     setPurchaseBills(parsedBills); // Load the raw saved bills
                } catch (error) {
                    console.error("Error loading purchase bills from localStorage:", error);
                    setPurchaseBills([]);
                }
            } else {
                 setPurchaseBills([]);
            }
        };

        loadData(); // Initial load

        // Add event listeners for data updates if needed (Product master updates might affect dropdown)
         // Listening for purchaseBillsUpdated is also useful if bills are saved elsewhere
        const handleDataUpdated = () => {
             console.log("PurchasePage: Data updated event received. Reloading data.");
             loadData(); // Reload both products and purchase bills
         };


        window.addEventListener('productsUpdated', handleDataUpdated);
         window.addEventListener('purchaseBillsUpdated', handleDataUpdated);


        return () => {
            // Clean up event listeners
            window.removeEventListener('productsUpdated', handleDataUpdated);
            window.removeEventListener('purchaseBillsUpdated', handleDataUpdated);
        };

    }, []); // Empty dependency array means this runs only once on mount


    // --- Purchase Bill Management Functions ---

    // Handle general bill info changes
    const handleBillInfoChange = (e) => {
        const { name, value } = e.target;
        setCurrentBill({ ...currentBill, [name]: value });
    };

    // Handle item form input changes and trigger calculation
    const handleItemFormChange = (e) => {
        const { name, value } = e.target;

        setItemForm(prev => {
            const updatedForm = { ...prev, [name]: value };

            // --- Handle Product Selection and MRP Auto-fill ---
             if (name === 'product') {
                 const productDetails = products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
                 if (productDetails) {
                     const masterMrp = String(productDetails.mrp) || '';

                     // Auto-fill other fields from product master
                     updatedForm.unit = productDetails.unit || '';
                     updatedForm.discount = String(productDetails.discount) || '';
                     updatedForm.taxRate = String(productDetails.taxRate) || '';
                     updatedForm.itemsPerPack = String(productDetails.itemsPerPack) || '';

                     // Set the original MRP ref and state when a product is selected
                     updatedForm.originalMrp = masterMrp;
                     originalMrpRef.current = masterMrp;

                     // Set the form MRP to the master MRP initially
                     updatedForm.mrp = masterMrp; // This is the MRP that will be displayed and can be edited

                 } else {
                     // Clear related fields if product not found
                     updatedForm.unit = '';
                     updatedForm.mrp = '';
                     updatedForm.originalMrp = ''; // Clear original MRP state
                     updatedForm.discount = '';
                     updatedForm.taxRate = '';
                     updatedForm.itemsPerPack = '';
                     originalMrpRef.current = ''; // Clear ref
                     toast.warning(`Product "${value.trim()}" not found in master list.`);
                 }
             }
             // No MRP confirmation logic here anymore


            // Trigger recalculation of profit and margin whenever relevant fields change
            const {
                quantity, // This is total items
                ptr, // PTR per Pack
                itemsPerPack,
                mrp, // Use mrp from the form state (potentially adjusted)
                discount
            } = updatedForm;

            const calculationResult = calculateProfitAndMargin(
                quantity, // Pass total items
                ptr, // Pass PTR per Pack
                itemsPerPack,
                mrp, // Pass MRP per Pack (potentially adjusted)
                discount
            );

            return {
                ...updatedForm,
                totalItemAmount: calculationResult.totalItemAmount !== null ? calculationResult.totalItemAmount : 0,
                calculatedProfitPerPack: calculationResult.profitPerPack, // Update state with profit per pack
                calculatedTotalProfit: calculationResult.totalProfit, // Update state with total profit
                calculatedMargin: calculationResult.margin,
            };
        });
    };


     // Handle adding an item to the current bill
    const handleAddItemToBill = async (e) => { // Made async to use await with toast.promise
        e.preventDefault(); // Prevent form submission

        console.log("Attempting to add item to bill..."); // Log start of function

        const { product, batch, expiry, quantity, ptr, itemsPerPack, discount, unit, mrp, taxRate, totalItemAmount, calculatedProfitPerPack, calculatedTotalProfit, calculatedMargin, originalMrp } = itemForm; // Include originalMrp

         console.log("Item form state:", itemForm); // Log current form state

        // Basic validation for item fields
        if (!product.trim() || !batch.trim() || !expiry.trim() || quantity === '' || isNaN(Number(quantity)) || Number(quantity) <= 0 || ptr === '' || isNaN(Number(ptr)) || Number(ptr) < 0 || itemsPerPack === '' || isNaN(Number(itemsPerPack)) || Number(itemsPerPack) <= 0 || discount === '' || isNaN(Number(discount)) || Number(discount) < 0) {
            console.log("Validation failed: Missing or invalid fields."); // Log validation failure
            toast.error('Please fill in all required item details correctly.');
            return;
        }
         // REMOVED: Additional validation: Ensure quantity is a multiple of itemsPerPack
         // if (Number(quantity) % Number(itemsPerPack) !== 0) {
         //      console.log("Validation failed: Quantity not a multiple of Items per Pack."); // Log validation failure
         //     toast.error(`Quantity (${quantity}) must be a multiple of Items per Pack (${itemsPerPack}).`);
         //     return;
         // }

         console.log("Basic validation passed."); // Log validation success


         // Re-find product details to ensure we have the latest master data when adding
         const productDetails = products.find(p => p.name.toLowerCase() === product.trim().toLowerCase());
         if (!productDetails) {
             console.log("Validation failed: Product not found in master list."); // Log validation failure
             toast.error(`Product "${product.trim()}" not found in master list. Please add it first.`);
             return;
         }
         console.log("Product found in master:", productDetails); // Log product details


        // --- MRP Confirmation Logic (Moved here, using toast) ---
        const enteredMrp = String(mrp); // Get the MRP the user entered/left in the form
        const masterMrpFromMaster = String(originalMrp); // Get the original MRP from the master (stored when product was selected)

        console.log(`Entered MRP: ${enteredMrp}, Master MRP (from selection): ${masterMrpFromMaster}`); // Log MRP values

        let proceedAdding = true; // Flag to control if we proceed with adding the item

        if (masterMrpFromMaster !== '' && enteredMrp !== '' && enteredMrp !== masterMrpFromMaster) {
            // If a master MRP exists (from selection), an MRP was entered, and they are different
            console.log("MRP mismatch detected. Showing confirmation toast."); // Log confirmation trigger
            proceedAdding = await new Promise((resolve) => {
                toast.warning(
                    `The entered MRP for "${productDetails.name}" is ₹${enteredMrp}, ` +
                    `but the Product Master MRP was ₹${masterMrpFromMaster} when selected.`, // Clarified message
                    {
                        action: {
                            label: 'Add with Entered MRP',
                            onClick: () => resolve(true), // Resolve with true if confirmed
                        },
                        cancel: {
                            label: 'Cancel',
                            onClick: () => resolve(false), // Resolve with false if canceled
                        },
                        duration: 10000, // Keep the toast visible for 10 seconds
                    }
                );
            });
             if (!proceedAdding) {
                 console.log("User canceled adding item due to MRP mismatch."); // Log cancellation
                 toast.info("Adding item canceled.");
                 return; // Stop the function here if not confirmed
             } else {
                  console.log("User confirmed adding item with entered MRP."); // Log confirmation
                  toast.success("MRP confirmed. Adding item with entered MRP.");
             }

        } else if (masterMrpFromMaster !== '' && enteredMrp === '') {
             // If a master MRP exists (from selection) but no MRP was entered in the form
             console.log("Master MRP exists (from selection), but entered MRP is empty. Showing confirmation toast."); // Log confirmation trigger
             proceedAdding = await new Promise((resolve) => {
                 toast.warning(
                     `No MRP was entered for "${productDetails.name}", ` +
                     `but the Product Master MRP was ₹${masterMrpFromMaster} when selected.`, // Clarified message
                     {
                         action: {
                             label: 'Add with Empty MRP',
                             onClick: () => resolve(true), // Resolve with true if confirmed
                         },
                         cancel: {
                             label: 'Cancel',
                             onClick: () => resolve(false), // Resolve with false if canceled
                         },
                         duration: 10000, // Keep the toast visible for 10 seconds
                     }
                 );
             });
              if (!proceedAdding) {
                  console.log("User canceled adding item due to empty MRP."); // Log cancellation
                  toast.info("Adding item canceled.");
                  return; // Stop the function here if not confirmed
              } else {
                   console.log("User confirmed adding item with empty MRP."); // Log confirmation
                   toast.success("Empty MRP confirmed. Adding item.");
              }
        }
        // If master MRP is empty, or entered MRP matches master MRP, or no MRP was entered and no master MRP exists, proceed without confirmation.
        console.log("Proceeding with adding item."); // Log proceeding


        // --- Add Item Logic ---
        try {
            const newItem = {
                id: Date.now() + Math.random(), // Unique ID for this item line
                product: productDetails.name, // Use original casing from master
                batch: batch.trim(),
                expiry: expiry.trim(),
                quantity: Number(quantity), // Store as number (total items)
                ptr: Number(ptr), // Store as number (PTR per Pack) - Note: PTR is from purchase, not needed for sales profit directly
                itemsPerPack: Number(itemsPerPack), // Store as number
                totalItemAmount: Number(totalItemAmount), // Store calculated total amount paid
                // Store other relevant details from product master/form at time of purchase
                unit: unit,
                mrp: Number(mrp), // Store the ENTERED/CONFIRMED MRP as 'mrp'
                originalMrp: Number(originalMrp) || 0, // Store the ORIGINAL MRP from master as 'originalMrp'
                discount: Number(discount), // Store the editable discount entered as number
                taxRate: Number(taxRate), // Store tax rate as number
                calculatedProfitPerPack: calculatedProfitPerPack !== null ? Number(calculatedProfitPerPack) : null, // Store calculated profit per pack
                calculatedTotalProfit: calculatedTotalProfit !== null ? Number(calculatedTotalProfit) : null, // Store calculated total profit
                calculatedMargin: calculatedMargin !== null ? Number(calculatedMargin) : null, // Store calculated margin
            };

            const updatedItems = [...currentBill.items, newItem];

            // Recalculate total bill amount
            const newTotalAmount = updatedItems.reduce((sum, item) => sum + (Number(item.totalItemAmount) || 0), 0);

            setCurrentBill({
                ...currentBill,
                items: updatedItems,
                totalAmount: newTotalAmount,
            });

            // Clear item form fields for the next item
             setItemForm({
                 id: null,
                 product: '', // Clear product name to encourage new selection or re-typing
                 batch: '',
                 expiry: '',
                 quantity: '',
                 ptr: '',
                 itemsPerPack: '',
                 unit: '', mrp: '', originalMrp: '', discount: '', taxRate: '', totalItemAmount: 0, // Clear originalMrp as well
                 calculatedProfitPerPack: null,
                 calculatedTotalProfit: null,
                 calculatedMargin: null,
             });
             originalMrpRef.current = ''; // Clear the ref


            toast.success(`Added ${newItem.quantity} items of "${newItem.product}" to the bill.`);
             console.log("Item added successfully."); // Log success
        } catch (error) {
            console.error("Error adding item to bill:", error); // Log any errors during item creation/state update
            toast.error("An error occurred while adding the item.");
        }
    };

     // Handle removing an item from the current bill
     const handleRemoveItemFromBill = (itemId) => {
          const updatedItems = currentBill.items.filter(item => item.id !== itemId);

          // Recalculate total bill amount
          const newTotalAmount = updatedItems.reduce((sum, item) => sum + (Number(item.totalItemAmount) || 0), 0);

          setCurrentBill({
              ...currentBill,
              items: updatedItems,
              totalAmount: newTotalAmount,
          });
           toast.info(`Removed item from the bill.`);
     };


    // Handle saving the entire purchase bill
    const handleSaveBill = () => {
        // Basic validation for the bill header
        if (!currentBill.billNumber.trim() || !currentBill.date.trim() || !currentBill.supplierName.trim()) {
            toast.error('Please fill in Bill Number, Date, and Supplier Name.');
            return;
        }

        if (currentBill.items.length === 0) {
            toast.error('Please add at least one item to the bill.');
            return;
        }

        const billToSave = {
            ...currentBill,
            id: currentBill.id || Date.now(), // Generate bill ID if new
            billNumber: currentBill.billNumber.trim(),
            supplierName: currentBill.supplierName.trim(),
            // date, items, and totalAmount are already in state
        };

        // Add the new bill to the list of saved bills
        const updatedBills = [...purchaseBills, billToSave];

        // Save updated bills list to localStorage
        try {
            localStorage.setItem('purchaseBills', JSON.stringify(updatedBills));
            setPurchaseBills(updatedBills); // Update component state

             // Dispatch event so other components (like Product Master, Sales, SearchAndDetails, Dashboard) can update stock/history
            window.dispatchEvent(new Event('purchaseBillsUpdated'));

            toast.success(`Purchase Bill "${billToSave.billNumber}" saved successfully!`);

            // Reset the current bill and item form for a new bill
            setCurrentBill({
                id: null,
                billNumber: '',
                date: formatDate(new Date()),
                supplierName: '',
                items: [],
                totalAmount: 0,
            });
             setItemForm({
                 id: null,
                 product: '', // Clear product name to encourage new selection or re-typing
                 batch: '',
                 expiry: '',
                 quantity: '',
                 ptr: '',
                 itemsPerPack: '',
                 unit: '', mrp: '', originalMrp: '', discount: '', taxRate: '', totalItemAmount: 0, // Clear originalMrp as well
                 calculatedProfitPerPack: null,
                 calculatedTotalProfit: null,
                 calculatedMargin: null,
             });
             originalMrpRef.current = ''; // Clear the ref

        } catch (error) {
            console.error("Error saving purchase bill to localStorage:", error);
            toast.error("Error saving purchase bill data. Local storage might be full.");
        }
    };


    // --- Rendered JSX ---
    return (
        <div>
            <Header />
            {/* Added fade-in class to the main container */}
            <div className="container mx-auto p-6 bg-white shadow-md rounded-lg fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Purchase Bills</h2>
                    <Button onClick={() => router.push("/")} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">Go to Dashboard</Button>
                </div>

                {/* --- Integrate the reusable ProductSearchAndDetails component --- */}
                 {/* Added fade-in-item class */}
                 <div className="mb-6 fade-in-item"> {/* Add some spacing around the component */}
                     {/* You can pass props here if the component needs them */}
                     {/* <ProductSearchAndDetails /> */}
                     {/* Temporarily commenting out ProductSearchAndDetails as it might not be needed directly on this page if the form handles product lookup */}
                     {/* If ProductSearchAndDetails is intended for general product info lookup, keep it. If it's for adding items, we are replacing that part with the form below. */}
                     {/* Assuming ProductSearchAndDetails is for general lookup, keeping it here */}
                      <ProductSearchAndDetails />
                 </div>
                 {/* --- End ProductSearchAndDetails component --- */}


                {/* --- New Purchase Bill Section --- */}
                 {/* Added fade-in-item class */}
                 <div className="mb-6 border p-4 rounded-lg bg-gray-50 fade-in-item">
                      <h3 className="text-xl font-semibold mb-3">Add New Purchase Bill</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                         <div>
                             <label className="block text-sm font-medium text-gray-700">Bill Number</label>
                             <input
                                 type="text"
                                 name="billNumber"
                                 value={currentBill.billNumber}
                                 onChange={handleBillInfoChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                 required
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Date</label>
                             <input
                                 type="date"
                                 name="date"
                                 value={currentBill.date} // Assuming date is stored as 'YYYY-MM-DD' or similar for input type="date"
                                 onChange={handleBillInfoChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                 required
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
                             <input
                                 type="text"
                                 name="supplierName"
                                 value={currentBill.supplierName}
                                 onChange={handleBillInfoChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                 required
                             />
                         </div>
                      </div>

                       <h4 className="text-lg font-semibold mb-2">Add Items to Bill</h4>
                      <form onSubmit={handleAddItemToBill} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Product Name</label>
                              <input
                                  type="text"
                                  name="product"
                                  value={itemForm.product}
                                  onChange={handleItemFormChange}
                                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                   placeholder="Product Name"
                                  required
                                   list="product-suggestions-purchase" // Link to datalist below
                              />
                               {/* Datalist for product suggestions (uses the 'products' state loaded in this page) */}
                               <datalist id="product-suggestions-purchase">
                                    {products.map(product => (
                                        <option key={product.id} value={product.name} />
                                    ))}
                                </datalist>
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Batch No.</label>
                             <input
                                 type="text"
                                 name="batch"
                                 value={itemForm.batch}
                                 onChange={handleItemFormChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                  placeholder="Batch No."
                                 required
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Expiry (MM-YY)</label>
                             <input
                                 type="text"
                                 name="expiry"
                                 value={itemForm.expiry}
                                 onChange={handleItemFormChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                  placeholder="MM-YY"
                                 required
                                   pattern="\d{2}-\d{2}" // Simple pattern for MM-YY
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Quantity (Items)</label>
                             <input
                                 type="number"
                                 name="quantity"
                                 value={itemForm.quantity}
                                 onChange={handleItemFormChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                  placeholder="Total Items"
                                 required
                                  min="1"
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">PTR (₹ per Pack)</label>
                             <input
                                 type="number"
                                 name="ptr"
                                 value={itemForm.ptr}
                                 onChange={handleItemFormChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                  placeholder="PTR per Pack"
                                 required
                                  min="0"
                                  step="0.01"
                             />
                         </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700">Items per Pack (on Purchase)</label>
                             <input
                                 type="number"
                                 name="itemsPerPack"
                                 value={itemForm.itemsPerPack}
                                 onChange={handleItemFormChange}
                                 className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                  placeholder="Items per Pack"
                                 required
                                  min="1"
                             />
                         </div>
                            {/* MRP and Tax Rate fields from master data (can remain read-only) */}
                            <div className="col-span-full md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700">Unit (from Master)</label>
                                <input type="text" value={itemForm.unit} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
                            </div>
                             <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">MRP (₹ per Pack)</label> {/* Updated label */}
                                 <input
                                     type="number" // Made editable
                                     name="mrp"
                                     value={itemForm.mrp}
                                     onChange={handleItemFormChange}
                                     className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                      placeholder="MRP per Pack"
                                     required
                                      min="0"
                                      step="0.01"
                                 />
                             </div>
                            <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">Tax (%) (from Master)</label>
                                 <input type="text" value={`${Number(itemForm.taxRate).toFixed(2)}%`} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
                             </div>
                             {/* Make Discount field editable */}
                             <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">Discount (%)</label>
                                 <input
                                     type="number"
                                     name="discount"
                                     value={itemForm.discount}
                                     onChange={handleItemFormChange} // Allow changing discount
                                     className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                      placeholder="Discount %"
                                     required
                                      min="0"
                                      step="0.01"
                                 />
                             </div>

                            {/* Display Calculated Profit and Margin */}
                            <div className="col-span-full md:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Calculated Profit per Pack (₹)</label> {/* Updated label */}
                                    <input
                                        type="text"
                                        value={itemForm.calculatedProfitPerPack !== null ? `₹${itemForm.calculatedProfitPerPack.toFixed(2)}` : '-'}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100 font-semibold"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Calculated Total Profit (₹)</label>
                                    <input
                                        type="text"
                                        value={itemForm.calculatedTotalProfit !== null ? `₹${itemForm.calculatedTotalProfit.toFixed(2)}` : '-'}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100 font-semibold"
                                        readOnly
                                    />
                                </div>
                                {/* Margin is still calculated per pack and displayed */}
                                 <div className="col-span-full">
                                     <label className="block text-sm font-medium text-gray-700">Calculated Margin (%)</label>
                                     <input
                                         type="text"
                                         value={itemForm.calculatedMargin !== null ? `${itemForm.calculatedMargin.toFixed(2)}%` : '-'}
                                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100 font-semibold"
                                         readOnly
                                     />
                                 </div>
                            </div>


                           <div className="col-span-full flex justify-end">
                                <Button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                                     <Plus className="mr-2 h-4 w-4" /> Add Item to Bill
                                 </Button>
                           </div>
                      </form>

                       {/* Current Bill Items Table */}
                       {currentBill.items.length > 0 && (
                           <div className="mt-6">
                               <h4 className="text-lg font-semibold mb-2">Items in Current Bill</h4>
                               <div className="overflow-x-auto">
                                    <table className="min-w-full table-auto border-collapse border border-gray-300 text-sm">
                                        <thead>
                                             <tr className="bg-gray-200 text-left">
                                                 <th className="border border-gray-300 px-3 py-2">Product</th>
                                                 <th className="border border-gray-300 px-3 py-2">Batch</th>
                                                 <th className="border border-gray-300 px-3 py-2">Expiry</th>
                                                 <th className="border border-gray-300 px-3 py-2">Qty (Items)</th>
                                                 <th className="border border-gray-300 px-3 py-2">PTR/Pack</th>
                                                 <th className="border border-gray-300 px-3 py-2">Items/Pack</th>
                                                  <th className="border border-gray-300 px-3 py-2">Entered MRP/Pack</th> {/* Updated label */}
                                                  <th className="border border-gray-300 px-3 py-2">Master MRP/Pack</th> {/* NEW column */}
                                                  <th className="border border-gray-300 px-3 py-2">Tax</th>
                                                 {/* Display editable discount */}
                                                  <th className="border border-gray-300 px-3 py-2">Discount (%)</th>
                                                  {/* New columns for calculated profit and margin */}
                                                  <th className="border border-gray-300 px-3 py-2">Profit/Pack (₹)</th>
                                                  <th className="border border-gray-300 px-3 py-2">Total Profit (₹)</th>
                                                  <th className="border border-gray-300 px-3 py-2">Margin (%)</th>
                                                 <th className="border border-gray-300 px-3 py-2">Item Total (₹)</th>
                                                 <th className="border border-gray-300 px-3 py-2 text-center">Action</th>
                                             </tr>
                                        </thead>
                                        <tbody>
                                             {currentBill.items.map(item => (
                                                 // Added fade-in-item class
                                                 <tr key={item.id} className="hover:bg-gray-100 fade-in-item">
                                                     <td className="border border-gray-300 px-3 py-2">{item.product}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.batch}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.expiry}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.quantity}</td>
                                                     <td className="border border-gray-300 px-3 py-2">₹{Number(item.ptr).toFixed(2)}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.itemsPerPack}</td>
                                                      <td className="border border-gray-300 px-3 py-2">₹{Number(item.mrp).toFixed(2)}</td> {/* Display Entered MRP */}
                                                      <td className="border border-gray-300 px-3 py-2">₹{Number(item.originalMrp).toFixed(2)}</td> {/* Display Original Master MRP */}
                                                      <td className="border border-gray-300 px-3 py-2">{Number(item.taxRate).toFixed(2)}%</td>
                                                     {/* Display the stored editable discount */}
                                                      <td className="border border-gray-300 px-3 py-2">{Number(item.discount).toFixed(2)}%</td>
                                                      {/* Display stored calculated profit per pack and total profit */}
                                                      <td className="border border-gray-300 px-3 py-2 text-green-700 font-semibold">
                                                          {item.calculatedProfitPerPack !== null ? `₹${Number(item.calculatedProfitPerPack).toFixed(2)}` : '-'}
                                                      </td>
                                                       <td className="border border-gray-300 px-3 py-2 text-green-700 font-semibold">
                                                          {item.calculatedTotalProfit !== null ? `₹${Number(item.calculatedTotalProfit).toFixed(2)}` : '-'}
                                                      </td>
                                                      <td className="border border-gray-300 px-3 py-2 text-green-700 font-semibold">
                                                          {item.calculatedMargin !== null ? `${Number(item.calculatedMargin).toFixed(2)}%` : '-'}
                                                      </td>
                                                     <td className="border border-gray-300 px-3 py-2">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                                     <td className="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                                                         <Button size="sm" onClick={() => handleRemoveItemFromBill(item.id)} className="bg-red-500 hover:bg-red-600 text-white p-1" title="Remove Item">
                                                              <Trash2 className="h-4 w-4" />
                                                         </Button>
                                                     </td>
                                                 </tr>
                                             ))}
                                        </tbody>
                                    </table>
                               </div>
                               <div className="text-right font-bold mt-2 text-lg">
                                   Bill Total: ₹{Number(currentBill.totalAmount).toFixed(2)}
                               </div>
                           </div>
                       )}

                       {/* Save Bill Button */}
                       {currentBill.items.length > 0 && (
                            <div className="flex justify-end mt-4">
                                <Button onClick={handleSaveBill} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                                    Save Purchase Bill
                                </Button>
                            </div>
                       )}

                 </div>


                 {/* --- Display Saved Purchase Bills (Optional/Simplified) --- */}
                  {/* You could add another section here to list saved bills if needed */}
                  {/* For example, loop through the 'purchaseBills' state and display them */}
                   {/* <div className="mt-6">
                       <h3 className="text-xl font-semibold mb-3">Saved Purchase Bills</h3>
                       {purchaseBills.length > 0 ? (
                           // ... table or list to display saved bills ...
                           <p>[Display list of saved bills here]</p> // Placeholder
                       ) : (
                           <p>No saved purchase bills found.</p>
                       )}
                   </div> */}


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
            `}</style>
        </div>
    );
};

export default PurchasePage;
