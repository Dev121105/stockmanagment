// app/purchase/page.js
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../components/button'; // Adjust path if needed
import { useRouter } from 'next/navigation';
import Header from '../components/Header'; // Adjust path if needed
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react'; // Keep icons needed for the bill form

// Import the new reusable component
import ProductSearchAndDetails from '../components/ProductSearchAndDetails'; // Adjust path if needed

// Helper functions (Keep these if needed elsewhere in the PurchasePage,
// otherwise, they are used by ProductSearchAndDetails internally now)
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

// parseMonthYearDate and other stock/history helpers are now inside ProductSearchAndDetails


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
        // Fields to store from product master or calculate (optional to store here, or derive when adding)
        unit: '',
        mrp: '',
        discount: '',
        taxRate: '',
        totalItemAmount: 0, // Calculated total for this item line
    });

    // State for saved purchase bills
    const [purchaseBills, setPurchaseBills] = useState([]);
    // State for product master data (needed for the item form product suggestion and detail lookup)
    const [products, setProducts] = useState([]);


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

    // Handle item form input changes
    const handleItemFormChange = (e) => {
        const { name, value } = e.target;
        setItemForm({ ...itemForm, [name]: value });

         // Optional: Auto-fill item form fields based on selected product name from master list
         if (name === 'product' && value.trim()) {
             const productDetails = products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
             if (productDetails) {
                 setItemForm(prev => ({
                      ...prev,
                      product: productDetails.name, // Use original casing name
                      unit: productDetails.unit,
                      mrp: String(productDetails.mrp),
                      discount: String(productDetails.discount),
                      taxRate: String(productDetails.taxRate),
                      itemsPerPack: String(productDetails.itemsPerPack), // Default items per pack from master
                 }));
             } else {
                 // Clear related fields if product not found
                 setItemForm(prev => ({
                     ...prev,
                     unit: '', mrp: '', discount: '', taxRate: '', itemsPerPack: '',
                 }));
             }
         }
    };


     // Handle adding an item to the current bill
    const handleAddItemToBill = (e) => {
        e.preventDefault(); // Prevent form submission

        const { product, batch, expiry, quantity, ptr, itemsPerPack } = itemForm;

        // Basic validation for item fields
        if (!product.trim() || !batch.trim() || !expiry.trim() || quantity === '' || isNaN(Number(quantity)) || Number(quantity) <= 0 || ptr === '' || isNaN(Number(ptr)) || Number(ptr) < 0 || itemsPerPack === '' || isNaN(Number(itemsPerPack)) || Number(itemsPerPack) <= 0) {
            toast.error('Please fill in all required item details correctly.');
            return;
        }

         // Re-find product details to ensure we have the latest master data when adding
         const productDetails = products.find(p => p.name.toLowerCase() === product.trim().toLowerCase());
         if (!productDetails) {
             toast.error(`Product "${product.trim()}" not found in master list. Please add it first.`);
             return;
         }


         const quantityNum = Number(quantity); // Total items purchased in this line
         const ptrNum = Number(ptr); // Price to Retailer per PACK
         const itemsPerPackNum = Number(itemsPerPack); // Items per pack for *this* purchase entry


         // Calculate total amount for this item line: (PTR / ItemsPerPack) * TotalItems
         const totalItemAmount = (ptrNum / itemsPerPackNum) * quantityNum;


        const newItem = {
            id: Date.now() + Math.random(), // Unique ID for this item line
            product: productDetails.name, // Use original casing from master
            batch: batch.trim(),
            expiry: expiry.trim(),
            quantity: quantityNum,
            ptr: ptrNum,
            itemsPerPack: itemsPerPackNum,
            totalItemAmount: totalItemAmount,
            // Store other relevant details from product master/form at time of purchase
            unit: productDetails.unit,
            mrp: productDetails.mrp, // Store MRP at time of purchase
            discount: productDetails.discount, // Store default discount at time of purchase
            taxRate: productDetails.taxRate, // Store tax rate at time of purchase
        };

        const updatedItems = [...currentBill.items, newItem];

        // Recalculate total bill amount
        const newTotalAmount = updatedItems.reduce((sum, item) => sum + item.totalItemAmount, 0);

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
             unit: '', mrp: '', discount: '', taxRate: '', totalItemAmount: 0,
         });


        toast.success(`Added ${newItem.quantity} items of "${newItem.product}" to the bill.`);
    };

     // Handle removing an item from the current bill
     const handleRemoveItemFromBill = (itemId) => {
          const updatedItems = currentBill.items.filter(item => item.id !== itemId);

          // Recalculate total bill amount
          const newTotalAmount = updatedItems.reduce((sum, item) => sum + item.totalItemAmount, 0);

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
            // date and items are already in state
        };

        // Add the new bill to the list of saved bills
        const updatedBills = [...purchaseBills, billToSave];

        // Save updated bills list to localStorage
        try {
            localStorage.setItem('purchaseBills', JSON.stringify(updatedBills));
            setPurchaseBills(updatedBills); // Update component state

             // Dispatch event so other components (like Product Master, Sales, SearchAndDetails) can update stock/history
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
                 product: '',
                 batch: '',
                 expiry: '',
                 quantity: '',
                 ptr: '',
                 itemsPerPack: '',
                 unit: '', mrp: '', discount: '', taxRate: '', totalItemAmount: 0,
             });

        } catch (error) {
            console.error("Error saving purchase bill to localStorage:", error);
            toast.error("Error saving purchase bill data. Local storage might be full.");
        }
    };


    // --- Rendered JSX ---
    return (
        <div>
            <Header />
            <div className="container mx-auto p-6 bg-white shadow-md rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Purchase Bills</h2>
                    <Button onClick={() => router.push("/")} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">Go to Dashboard</Button>
                </div>

                {/* --- Integrate the reusable ProductSearchAndDetails component --- */}
                 <div className="mb-6"> {/* Add some spacing around the component */}
                     <ProductSearchAndDetails
                         // You can pass props here if the component needs them, e.g.,
                         // onEditProduct={(product) => handleEditProduct(product)}
                     />
                 </div>
                 {/* --- End ProductSearchAndDetails component --- */}


                {/* --- New Purchase Bill Section --- */}
                 <div className="mb-6 border p-4 rounded-lg bg-gray-50">
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
                            {/* Displaying auto-populated fields from master data */}
                            <div className="col-span-full md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700">Unit (from Master)</label>
                                <input type="text" value={itemForm.unit} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
                            </div>
                             <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">MRP (from Master)</label>
                                 <input type="text" value={`₹${Number(itemForm.mrp).toFixed(2)}`} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
                             </div>
                            <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">Tax (%) (from Master)</label>
                                 <input type="text" value={`${Number(itemForm.taxRate).toFixed(2)}%`} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
                             </div>
                             <div className="col-span-full md:col-span-1">
                                 <label className="block text-sm font-medium text-gray-700">Discount (%) (from Master)</label>
                                 <input type="text" value={`${Number(itemForm.discount).toFixed(2)}%`} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100" readOnly />
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
                                                  <th className="border border-gray-300 px-3 py-2">MRP</th>
                                                  <th className="border border-gray-300 px-3 py-2">Tax</th>
                                                  <th className="border border-gray-300 px-3 py-2">Discount</th>
                                                 <th className="border border-gray-300 px-3 py-2">Item Total</th>
                                                 <th className="border border-gray-300 px-3 py-2 text-center">Action</th>
                                             </tr>
                                        </thead>
                                        <tbody>
                                             {currentBill.items.map(item => (
                                                 <tr key={item.id} className="hover:bg-gray-100">
                                                     <td className="border border-gray-300 px-3 py-2">{item.product}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.batch}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.expiry}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.quantity}</td>
                                                     <td className="border border-gray-300 px-3 py-2">₹{Number(item.ptr).toFixed(2)}</td>
                                                     <td className="border border-gray-300 px-3 py-2">{item.itemsPerPack}</td>
                                                      <td className="border border-gray-300 px-3 py-2">₹{Number(item.mrp).toFixed(2)}</td>
                                                      <td className="border border-gray-300 px-3 py-2">{Number(item.taxRate).toFixed(2)}%</td>
                                                      <td className="border border-gray-300 px-3 py-2">{Number(item.discount).toFixed(2)}%</td>
                                                     <td className="border border-gray-300 px-3 py-2">₹{Number(item.totalItemAmount).toFixed(2)}</td>
                                                     <td className="border border-gray-300 px-3 py-2 text-center">
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
        </div>
    );
};

export default PurchasePage;