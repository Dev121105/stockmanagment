"use client";

import React, { useState, useEffect, useCallback } from "react";
// Verify this path is correct relative to salespage.js
import Header from "../components/Header";
import Link from 'next/link';
import { toast } from 'sonner';
// Verify this path is correct relative to salespage.js
import { Button } from "../components/button";
// Verify these paths are correct based on your shadcn/ui setup
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// Ensure all used icons are imported
import { Trash2, Edit, Save, X, AlertCircle, Plus, RotateCcw, XCircle } from 'lucide-react';
// Verify this path is correct based on your shadcn/ui setup
import { cn } from "@/lib/utils";


// Helper function to format date as DD-MM-YYYY
const formatDate = (date) => {
    if (!date) return ''; // Handle null or undefined date
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

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

// Helper function to format date as MM-YYYY
function formatDateMonthYear(date) {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}-${year}`;
}

// Helper function to parse MM-YYYY date strings into a Date object
function parseMonthYearDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return null; // Return null for empty or invalid string
    }
    const [month, year] = dateString.split('-');
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    if (month && year && !isNaN(monthInt) && !isNaN(yearInt)) {
        if (monthInt >= 1 && monthInt <= 12 && yearInt >= 1900 && yearInt <= 2100) {
            return new Date(yearInt, monthInt - 1, 1); // Use day 1 for consistency
        }
    }
    return null; // Return null for invalid format
}


const SalesPage = () => {
    const [billNumber, setBillNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [date, setDate] = useState(formatDate(new Date()));
    // Products state now holds data from Product Master (including itemsPerPack)
    const [products, setProducts] = useState([]);
    // saleItems state now includes packsSold and itemsPerPack, pre-filled from Product Master
    const [saleItems, setSaleItems] = useState([{ product: "", packsSold: '', itemsPerPack: '', quantity: '', batch: '', expiry: '' }]); // Added packsSold, itemsPerPack, quantity
    const [bills, setBills] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredBills, setFilteredBills] = useState([]);
    // History and undo stack are not directly integrated with Product Master updates in this context, keeping them as is.
    const [history, setHistory] = useState([]);
    const [undoStack, setUndoStack] = useState([]);
    const [editBill, setEditBill] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [billToDelete, setBillToDelete] = useState(null);

     // Load data from localStorage on component mount and set up event listener
    useEffect(() => {
        const loadProducts = () => {
            const storedProducts = localStorage.getItem("products");
            if (storedProducts) {
                try {
                     // Ensure numeric fields are numbers on load for product master data, include itemsPerPack
                    const parsedProducts = JSON.parse(storedProducts);
                     const updatedProducts = parsedProducts.map(product => ({
                         ...product,
                          quantity: Number(product.quantity) || 0, // Stock quantity (individual items)
                          mrp: Number(product.mrp) || 0, // Selling price (per item)
                          minStock: Number(product.minStock) || 0,
                          maxStock: Number(product.maxStock) || 0,
                          discount: Number(product.discount) || 0, // Default discount
                          taxRate: Number(product.taxRate) || 0, // Default tax rate
                          itemsPerPack: Number(product.itemsPerPack) || 1, // Items per pack
                          // Expiry/Batch from Product Master might be default
                          batch: product.batch || '',
                          expiry: product.expiry || '',
                     }));
                    setProducts(updatedProducts);
                     console.log("Products loaded in SalesPage:", updatedProducts); // Debugging log
                } catch (error) {
                    console.error("Error parsing products in SalesPage:", error);
                    setProducts([]);
                }
            } else {
                 console.log("No products found in localStorage on SalesPage mount."); // Debugging log
                 setProducts([]);
            }
        };

        const loadLastBillNumber = () => {
            const lastBill = localStorage.getItem("lastBillNumber");
            if (lastBill) {
                setBillNumber(lastBill);
            } else {
                const newBill = 1;
                setBillNumber(newBill.toString());
                localStorage.setItem("lastBillNumber", newBill.toString());
            }
        };

        const loadBills = () => {
            const storedBills = localStorage.getItem("bills");
            if (storedBills) {
                try {
                    const parsedBills = JSON.parse(storedBills);
                     // Ensure numeric fields and date formats are correct on load for bills, include new fields
                     const updatedBills = parsedBills.map(bill => ({
                         ...bill,
                         items: bill.items.map(item => ({
                             ...item,
                              packsSold: Number(item.packsSold) || 0, // Packs sold
                              itemsPerPack: Number(item.itemsPerPack) || 1, // Items per pack for this sale
                              quantity: Number(item.quantity) || 0, // Total individual items (calculated)
                              mrp: Number(item.mrp) || 0, // MRP stored with the bill item
                              // Ensure expiry is in MM-YYYY string format for display if needed
                              expiry: item.expiry ? (formatDateMonthYear(parseMonthYearDate(item.expiry)) || '') : '',
                              // Include other item properties like batch
                              batch: item.batch || '',
                         })),
                          // Ensure bill date is formatted for display - use parseDate helper
                         date: bill.date ? (formatDate(parseDate(bill.date)) || '') : '', // Default to empty string if parsing fails
                          // Ensure totalAmount is a number
                         totalAmount: Number(bill.totalAmount) || 0,
                     }));
                    setBills(updatedBills);
                    setFilteredBills(updatedBills);
                     console.log("Sales bills loaded:", updatedBills); // Debugging log
                } catch (error) {
                    console.error("Error parsing sales bills:", error);
                    setBills([]);
                    setFilteredBills([]);
                }
            } else {
                 console.log("No sales bills found in localStorage on SalesPage mount."); // Debugging log
                 setBills([]);
                 setFilteredBills([]);
            }
        };

        // History loading is kept as is
        const loadHistory = () => {
             const storedHistory = localStorage.getItem("history");
             if (storedHistory) {
                 try {
                     setHistory(JSON.parse(storedHistory));
                 } catch (error) {
                      console.error("Error parsing history:", error);
                      setHistory([]);
                 }
             }
         };


        // Initial load
        loadProducts();
        loadLastBillNumber();
        loadBills();
        loadHistory(); // Load history

         // Set up event listener for product updates from Product Master
        const handleProductsUpdated = () => {
            console.log("Products updated event received in SalesPage. Reloading products."); // Debugging log
            loadProducts(); // Reload products when the event is dispatched
        };

        window.addEventListener('productsUpdated', handleProductsUpdated);

        // Clean up event listener on component unmount
        return () => {
            console.log("SalesPage unmounting. Removing event listener."); // Debugging log
            window.removeEventListener('productsUpdated', handleProductsUpdated);
        };

    }, []); // Empty dependency array means this runs only once on mount


    useEffect(() => {
        const query = searchQuery.toLowerCase();
        const filtered = bills.filter(bill =>
            bill.billNumber.toLowerCase().includes(query) ||
            bill.customerName.toLowerCase().includes(query) ||
            bill.date.includes(query) // Assuming date is stored/formatted as DD-MM-YYYY string for search
        );
        setFilteredBills(filtered);
         // Reset editBill when search query changes
        setEditBill(null);
    }, [searchQuery, bills]); // Dependencies are searchQuery and bills

    // Handle date change (still in DD-MM-YYYY format for the main bill date input)
    const handleDateChange = (e) => {
         // Assuming the input value is already in DD-MM-YYYY format due to input type="text" and placeholder
         // You might want to add validation here to ensure the format is correct
        setDate(e.target.value);
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...saleItems];
        updated[index][field] = value;

         // If the product name is changed and matches an existing product from Product Master, pre-fill other fields
        if (field === 'product' && value.trim() !== '') {
            const selectedProduct = products.find(p => p.name === value.trim());
            if (selectedProduct) {
                console.log(`Product "${value.trim()}" found in Product Master. Pre-filling details.`); // Debugging log
                // Pre-fill itemsPerPack, batch, and expiry from Product Master
                updated[index]['itemsPerPack'] = String(selectedProduct.itemsPerPack) || '1'; // Pre-fill items per pack, default to 1
                updated[index]['batch'] = selectedProduct.batch || ''; // Pre-fill batch
                updated[index]['expiry'] = selectedProduct.expiry || ''; // Pre-fill expiry (MM-YYYY string)
                 // Clear packsSold and quantity to force re-entry/recalculation
                 updated[index]['packsSold'] = '';
                 updated[index]['quantity'] = 0; // Reset calculated quantity
                 // MRP is looked up dynamically, no need to store it in item state here
            } else {
                 console.log(`Product "${value.trim()}" not found in Product Master.`); // Debugging log
                 // If product not found, clear associated fields to avoid confusion
                 updated[index]['packsSold'] = '';
                 updated[index]['itemsPerPack'] = ''; // Clear items per pack if product not found
                 updated[index]['quantity'] = 0; // Reset calculated quantity
                 updated[index]['batch'] = '';
                 updated[index]['expiry'] = '';
            }
        }

        // Calculate total quantity (individual items) whenever packsSold or itemsPerPack changes
        if (field === 'packsSold' || field === 'itemsPerPack') {
            const packs = Number(updated[index]['packsSold']) || 0;
            const items = Number(updated[index]['itemsPerPack']) || 1; // Default to 1 if itemsPerPack is invalid/empty
            updated[index]['quantity'] = packs * items; // Calculate total individual items
        }


        setSaleItems(updated);
    };

    const addItem = () => {
         // Add new item with empty fields, including packsSold, itemsPerPack, quantity, batch and expiry
        setSaleItems([...saleItems, { product: "", packsSold: '', itemsPerPack: '', quantity: 0, batch: '', expiry: '' }]); // Initialize quantity to 0
    };

    const removeItem = (index) => {
        const updatedItems = [...saleItems];
        updatedItems.splice(index, 1);
        setSaleItems(updatedItems);
    };

    // Get product details from the current products state (loaded from Product Master)
    const getProductDetails = (productName) => {
        return products.find((p) => p.name === productName);
    };

    // Calculate row total based on product MRP and item quantity (individual items)
    const calculateRowTotal = (item) => {
        const product = getProductDetails(item.product);
        // Use the MRP from the Product Master (per item)
        const mrp = product?.mrp ? Number(product.mrp) : 0; // Ensure MRP is a number
        const quantity = item.quantity ? Number(item.quantity) : 0; // Use calculated individual item quantity

        // Return 0 if any value is invalid or negative
        if (isNaN(mrp) || isNaN(quantity) || mrp < 0 || quantity < 0) {
            return 0;
        }

        return mrp * quantity; // Total is quantity (items) * MRP per item
    };

    // Calculate grand total for the entire sale
    const calculateGrandTotal = () => {
        return saleItems.reduce((total, item) => total + calculateRowTotal(item), 0);
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Function to validate form data before saving/updating
    const validateFormData = () => {
        console.log("Validating form data..."); // Debugging log
        if (!customerName.trim()) {
            toast.error("Please enter customer name.");
            console.log("Validation failed: Customer name empty."); // Debugging log
            return false;
        }

        if (saleItems.length === 0) {
            toast.error("Please add at least one item to the sale.");
            console.log("Validation failed: No sale items."); // Debugging log
            return false;
        }

        for (const item of saleItems) {
             // Validate required fields for each item
            if (!item.product.trim()) {
                 toast.error(`Please fill in the Product name for all items.`);
                 console.log(`Validation failed: Missing product name for item:`, item); // Debugging log
                 return false;
            }

            // Validate packsSold and itemsPerPack
            const packsSold = Number(item.packsSold);
            const itemsPerPack = Number(item.itemsPerPack);
            const quantity = Number(item.quantity); // Calculated quantity

            if (item.packsSold.trim() === '' || isNaN(packsSold) || packsSold <= 0) {
                 toast.error(`Invalid Packs Sold for product "${item.product}". Please enter a positive number.`);
                 console.log(`Validation failed: Invalid Packs Sold for item "${item.product}":`, item.packsSold); // Debugging log
                 return false;
            }
             if (item.itemsPerPack.trim() === '' || isNaN(itemsPerPack) || itemsPerPack <= 0) {
                  toast.error(`Invalid Items per Pack for product "${item.product}". Please ensure it's a positive number.`);
                  console.log(`Validation failed: Invalid Items per Pack for item "${item.product}":`, item.itemsPerPack); // Debugging log
                  return false;
             }
             // Calculated quantity (individual items) must be positive
             if (quantity <= 0) {
                 toast.error(`Calculated quantity for product "${item.product}" is not positive. Check Packs Sold and Items per Pack.`);
                 console.log(`Validation failed: Calculated quantity not positive for item "${item.product}":`, quantity); // Debugging log
                 return false;
             }


             // Validate batch and expiry (now required)
            if (!item.batch.trim()) {
                 toast.error(`Batch No is required for product "${item.product}".`);
                 console.log(`Validation failed: Missing batch for item:`, item); // Debugging log
                 return false;
            }

            // Validate expiry date format (MM-YYYY) - now it's required
            if (!item.expiry.trim() || !/^\d{2}-\d{4}$/.test(item.expiry.trim())) {
                toast.error(`Invalid or empty expiry date format for product "${item.product}". Please use MM-YYYY.`);
                 console.log(`Validation failed: Invalid expiry format for item "${item.product}":`, item.expiry); // Debugging log
                return false;
            }
             // Optional: Validate if expiry date is in the past (you might allow sales of expired items with a warning)
             const expiryDate = parseMonthYearDate(item.expiry);
             if (!expiryDate || expiryDate < new Date()) {
                 // toast.warning(`Expiry date for "${item.product}" is in the past or invalid.`);
                 // Decide if you want to block saving or just warn
             }


            // Check for sufficient stock (of individual items)
            const productDetails = getProductDetails(item.product);
            if (!productDetails) {
                 toast.error(`Product "${item.product}" not found in Product Master.`);
                 console.log(`Validation failed: Product "${item.product}" not found.`); // Debugging log
                 return false;
            }
            if (productDetails.quantity < quantity) { // Compare against total individual items in stock
                 toast.error(`Insufficient stock of "${item.product}". Available: ${productDetails.quantity} items`); // Show available items
                 console.log(`Validation failed: Insufficient stock for "${item.product}". Available: ${productDetails.quantity}, Requested: ${quantity}`); // Debugging log
                 return false;
            }
        }
         console.log("Validation successful."); // Debugging log
        return true; // Validation passed
    };


    // Function to handle saving a new bill or updating an existing one
    const handleSaveBill = () => {
        console.log("handleSaveBill called. editBill:", editBill); // Debugging log
         if (!validateFormData()) {
             console.log("Validation failed, stopping save/update."); // Debugging log
             return; // Stop if validation fails
         }

        // --- Prepare data for saving/updating ---
        // Clone items for saving, ensuring numeric values are stored as numbers, include new fields
        const saleItemsToSave = saleItems.map(item => ({
            ...item,
             packsSold: Number(item.packsSold), // Store packs sold as number
             itemsPerPack: Number(item.itemsPerPack), // Store items per pack as number
             quantity: Number(item.quantity), // Store calculated individual item quantity as number
             // MRP, Batch, Expiry are stored with the bill item for historical record,
             // but fetched from Product Master for display/validation.
             // When saving, we capture the details from the item row state.
             mrp: getProductDetails(item.product)?.mrp || 0, // Store the MRP from Product Master at the time of sale
             batch: item.batch.trim(), // Store batch from the item row
             expiry: item.expiry.trim(), // Store expiry from the item row (MM-YYYY string)
        }));


        const currentBillData = {
            // If editing, keep the original bill number, otherwise use the current state
            billNumber: editBill ? editBill.billNumber : billNumber.trim(),
            customerName: customerName.trim(),
            date: date.trim(), // Use the date as entered (DD-MM-YYYY string)
            items: saleItemsToSave,
            totalAmount: calculateGrandTotal(), // Calculate total based on validated items
        };

        console.log("Prepared bill data:", currentBillData); // Debugging log

        // --- Update Stock (Products) ---
        // Clone products from the current state (which reflects Product Master) for modification
        const updatedProducts = products.map(p => ({ ...p }));
        let stockUpdated = false;


        if (editBill) {
             console.log("Updating existing bill stock..."); // Debugging log
             // --- Logic for Updating Stock when Editing ---
             const originalItems = editBill.items;
             const editedItems = saleItemsToSave;

             // Create maps for easier lookup by product name
             const originalItemsMap = new Map(originalItems.map(item => [item.product, item]));
             const editedItemsMap = new Map(editedItems.map(item => [item.product, item]));

             // Adjust stock based on changes from original items
             originalItemsMap.forEach((originalItem, productName) => {
                 const editedItem = editedItemsMap.get(productName);
                 // Find the product in the *current* products list (from Product Master)
                 const productToUpdate = updatedProducts.find(p => p.name === productName);

                 if (!productToUpdate) {
                     console.warn(`Product "${productName}" from original bill not found in current Product Master list. Cannot adjust stock.`);
                     return;
                 }

                 // Use the calculated individual item quantity for stock adjustments
                 const originalQuantity = Number(originalItem.quantity) || 0;
                 const editedQuantity = editedItem ? (Number(editedItem.quantity) || 0) : 0; // If item removed, edited quantity is 0

                 const quantityDifference = originalQuantity - editedQuantity; // Original minus edited for sales (adding back stock)

                 if (quantityDifference !== 0) {
                     productToUpdate.quantity += quantityDifference; // Adjust stock quantity in Product Master (individual items)
                     stockUpdated = true;
                     console.log(`Adjusted stock for "${productName}" by ${quantityDifference}. New quantity: ${productToUpdate.quantity}`); // Debugging log
                 }

                  // When editing, we don't update Product Master details (like MRP, batch, expiry, itemsPerPack, etc.)
                  // from the sales bill item. Those should be managed in Product Master.
                  // The sales bill item stores the details specific to that sale.

             });

             // Identify products that are new in the edited bill (not in original)
             editedItemsMap.forEach((editedItem, productName) => {
                 const originalItem = originalItemsMap.get(productName);
                 if (!originalItem) {
                     console.log(`Decreasing stock for new product "${productName}" in edited bill.`); // Debugging log
                     // Item is new in the edited bill - decrease quantity
                     // Find the product in the *current* products list (from Product Master)
                     const productToUpdate = updatedProducts.find(p => p.name === productName);
                     if (productToUpdate) {
                          // If product exists in Product Master, just subtract quantity
                          // Use the calculated individual item quantity from the edited item
                         productToUpdate.quantity = Number(productToUpdate.quantity) - editedItem.quantity; // Ensure existing quantity is number
                         // We do NOT update other Product Master details from sales here.
                         console.log(`Decreased quantity for existing product "${productName}". New quantity: ${productToUpdate.quantity}. Preserving Product Master details.`); // Debugging log
                     } else {
                          // Product is completely new and not in Product Master.
                          console.warn(`Product "${productName}" not found in Product Master when adding in edited bill. Stock will not be updated in Product Master.`);
                     }
                     // Stock is only considered updated if we found and modified a product in the list.
                     if(productToUpdate) stockUpdated = true;
                 }
             });

              // Ensure quantity doesn't go below zero for any product after adjustments
              updatedProducts.forEach(p => {
                  if (p.quantity < 0) {
                      console.warn(`Product "${p.name}" quantity went below zero after update. Setting to 0.`); // Debugging log
                      p.quantity = 0;
                  }
              });


         } else {
             console.log("Saving new bill stock..."); // Debugging log
             // --- Logic for Saving Stock for a New Bill ---
             saleItemsToSave.forEach(item => {
                 // Find the product in the *current* products list (from Product Master)
                 const productToUpdate = updatedProducts.find(p => p.name === item.product);
                 if (productToUpdate) {
                     // Subtract the calculated individual item quantity from stock
                     productToUpdate.quantity = Number(productToUpdate.quantity) - item.quantity; // Ensure existing quantity is number
                      // We do NOT update other Product Master details from sales here.
                     console.log(`Decreased quantity for existing product "${item.product}". New quantity: ${productToUpdate.quantity}. Preserving Product Master details.`); // Debugging log
                     stockUpdated = true;
                 } else {
                     // Product is completely new and not in Product Master.
                     console.warn(`Product "${item.product}" not found in Product Master when saving new bill. Stock will not be updated in Product Master.`);
                 }
             });
         }


        // Save updated products to localStorage ONLY IF stock was actually updated
        if (stockUpdated) {
            setProducts(updatedProducts); // Update local state
            localStorage.setItem("products", JSON.stringify(updatedProducts));
             // Dispatch a custom event so other components can react to product changes immediately.
            window.dispatchEvent(new Event('productsUpdated')); // Notify dashboard/other pages
            console.log("Products updated in localStorage (stock changes)."); // Debugging log
        }

        // --- Save/Update Sales Bill ---
        let updatedBills;
        if (editBill) {
             console.log("Updating sales bill in state and localStorage."); // Debugging log
             // Find the index of the bill being edited and replace it
             const billIndex = bills.findIndex(bill => bill.billNumber === editBill.billNumber);
             if (billIndex > -1) {
                 updatedBills = [...bills];
                 updatedBills[billIndex] = currentBillData;
                 setBills(updatedBills);
                 localStorage.setItem("bills", JSON.stringify(updatedBills));
                 toast.success(`Sales bill ${currentBillData.billNumber} updated successfully.`);
                 console.log("Bill updated successfully in state and localStorage."); // Debugging log
             } else {
                  // This case should ideally not happen if editBill is set correctly
                 console.error("Error updating bill: Original bill not found in state.", editBill);
                 toast.error("Error updating bill: Original bill not found.");
                  // Revert state or handle error appropriately
                 return; // Stop the process if the original bill isn't found
             }
        } else {
            console.log("Saving new sales bill to state and localStorage."); // Debugging log
            // Add the new bill
             // Check if a bill with the same number already exists before adding a NEW bill
             if (bills.some(bill => bill.billNumber.toLowerCase() === currentBillData.billNumber.toLowerCase())) {
                 toast.error(`Sales bill with number "${currentBillData.billNumber}" already exists.`);
                 console.log("Add failed: Bill number already exists."); // Debugging log
                 // Revert stock changes if the bill save fails due to duplicate bill number
                 if (stockUpdated) {
                     const revertedProducts = products.map(p => ({ ...p })); // Start from the state *before* stock changes
                     saleItemsToSave.forEach(item => {
                         const productToRevert = revertedProducts.find(p => p.name === item.product);
                         if (productToRevert) {
                             productToRevert.quantity = Number(productToRevert.quantity) + item.quantity;
                         }
                     });
                     setProducts(revertedProducts);
                     localStorage.setItem('products', JSON.stringify(revertedProducts));
                     window.dispatchEvent(new Event('productsUpdated'));
                     console.log("Stock changes reverted due to duplicate bill number."); // Debugging log
                 }
                 return;
             }
            updatedBills = [...bills, currentBillData];
            setBills(updatedBills);
            localStorage.setItem("bills", JSON.stringify(updatedBills));

             // Increment and save the last bill number only for new bills
            const newBillNumber = (parseInt(billNumber) + 1);
            setBillNumber(newBillNumber.toString());
            localStorage.setItem("lastBillNumber", newBillNumber.toString());

            toast.success("Sale completed successfully.");
            console.log("New bill saved successfully to state and localStorage."); // Debugging log
        }

        // Add history entry after successful save/update and stock adjustment
        addHistory(`Sale made to ${customerName.trim()} for Bill #${currentBillData.billNumber} with total ₹${currentBillData.totalAmount.toFixed(2)}`);

        // Reset form and editing state
        setCustomerName("");
        // Reset sale items with empty fields, including packsSold, itemsPerPack, quantity, batch and expiry
        setSaleItems([{ product: "", packsSold: '', itemsPerPack: '', quantity: 0, batch: '', expiry: '' }]); // Initialize quantity to 0
        setDate(formatDate(new Date())); // Reset date to current
        setEditBill(null); // Clear editing state

        // Undo stack logic - This needs careful consideration with stock updates.
        // Saving the entire products state before a sale/update allows reverting stock.
        // setUndoStack([{ products: [...products] }]); // This saves the state *before* the current changes.
        // A more robust undo would involve tracking specific changes (product, quantity, bill).
        // For now, keeping the basic undo stack structure but note its limitations.
    };

    // History logging function
    const addHistory = (action) => {
        const newEntry = { id: Date.now(), action, date: new Date().toISOString() };
        // Prepend new entry to history
        const updatedHistory = [newEntry, ...history];
        setHistory(updatedHistory);
        localStorage.setItem("history", JSON.stringify(updatedHistory));
         console.log("History updated:", updatedHistory); // Debugging log
    };

    // Undo last action - This currently only seems to revert product stock.
    // A full undo would need to revert bill changes as well.
    const undoLastAction = () => {
        if (undoStack.length === 0) {
            toast.info("No actions to undo.");
            return;
        }

        const previousState = undoStack[0]; // Get the state before the last action
        setUndoStack(undoStack.slice(1)); // Remove the last state from the stack

        // Revert products state
        setProducts(previousState.products);
        localStorage.setItem("products", JSON.stringify(previousState.products));
         console.log("Products reverted to previous state:", previousState.products); // Debugging log

        // Add a history entry for the undo action
        addHistory("Undid last stock adjustment."); // Be specific about what was undone
        toast.success("Last stock adjustment undone!");

        // Note: This undo only reverts stock changes. It does NOT revert bill saves/updates/deletes.
        // A more complete undo would require tracking changes to the bills state as well.
    };

    // Handle clicking the Edit button for a bill
    const handleEditBill = (bill) => {
        console.log("Editing bill:", bill); // Debugging log
        setEditBill(bill);
        setBillNumber(bill.billNumber); // Bill number is read-only in edit mode
        setCustomerName(bill.customerName);
        setDate(bill.date); // Date is read-only in edit mode
        // Populate sale items state from the bill data
        // Ensure numeric values are converted back to strings for input fields, include new fields
        setSaleItems(bill.items.map(item => ({
            ...item,
            packsSold: String(item.packsSold) || '', // Packs sold as string
            itemsPerPack: String(item.itemsPerPack) || '', // Items per pack as string
            quantity: Number(item.quantity) || 0, // Keep quantity as number (calculated field)
            batch: item.batch || '', // Include batch
            expiry: item.expiry || '', // Include expiry (MM-YYYY string)
            // MRP is looked up dynamically, no need to store it in item state here
        })));
         // Save current product state to undo stack before editing
         setUndoStack([{ products: [...products] }]);
         console.log("Saved current product state to undo stack for edit."); // Debugging log
    };

    // Handle confirmation dialog for deleting a bill
    const handleDeleteConfirmation = (bill) => {
        console.log("Showing delete confirmation for bill:", bill); // Debugging log
        setBillToDelete(bill);
        setIsDeleteDialogOpen(true);
    };

    // Handle deleting a bill after confirmation
    const handleDeleteBill = useCallback(() => {
        if (!billToDelete) {
            console.warn("handleDeleteBill called but no billToDelete is set."); // Debugging log
            return;
        }

        console.log("Deleting bill:", billToDelete); // Debugging log

        // --- Revert Stock Changes ---
        const updatedProducts = [...products]; // Clone current products state
        let stockUpdated = false;

        // Iterate through items in the bill being deleted and add quantities back to stock
        billToDelete.items.forEach(item => {
            const productToUpdate = updatedProducts.find(p => p.name === item.product);
            if (productToUpdate) {
                 // Add the quantity (individual items) back to stock
                productToUpdate.quantity = Number(productToUpdate.quantity) + Number(item.quantity); // Ensure quantities are numbers
                stockUpdated = true;
                console.log(`Reverted stock for "${item.product}". New quantity: ${productToUpdate.quantity}`); // Debugging log
            } else {
                console.warn(`Product "${item.product}" from bill being deleted not found in current Product Master list. Cannot revert stock.`);
            }
        });

        // Save updated products to localStorage ONLY IF stock was actually updated
        if (stockUpdated) {
            setProducts(updatedProducts); // Update local state
            localStorage.setItem('products', JSON.stringify(updatedProducts));
            // Dispatch event to notify other components (like Dashboard)
            window.dispatchEvent(new Event('productsUpdated'));
            console.log("Products updated in localStorage (stock reverted)."); // Debugging log
        }


        // --- Delete the Bill ---
        const updatedBills = bills.filter(b => b.billNumber !== billToDelete.billNumber);
        setBills(updatedBills);
        localStorage.setItem("bills", JSON.stringify(updatedBills));
        console.log(`Bill ${billToDelete.billNumber} deleted from state and localStorage.`); // Debugging log


        // Add history entry for deletion
        addHistory(`Deleted sales bill #${billToDelete.billNumber} for ${billToDelete.customerName}`);

        // Reset delete dialog state
        setIsDeleteDialogOpen(false);
        setBillToDelete(null);
        toast.success(`Bill ${billToDelete.billNumber} deleted successfully.`);

        // If the deleted bill was the one being edited, reset the form
        if (editBill && editBill.billNumber === billToDelete.billNumber) {
             console.log("Resetting form after deleting the edited bill."); // Debugging log
             resetForm();
        }

    }, [bills, billToDelete, products]); // Dependencies are bills, billToDelete, and products

    // Handle closing the delete confirmation dialog
    const handleCloseDeleteDialog = () => {
        console.log("Closing delete confirmation dialog."); // Debugging log
        setIsDeleteDialogOpen(false);
        setBillToDelete(null);
    };

    // Reset the form to its initial state for a new bill
    const resetForm = () => {
        console.log("Resetting form."); // Debugging log
        setEditBill(null); // Clear editing state
        // Load the next bill number from localStorage or default to '1'
        setBillNumber(localStorage.getItem('lastBillNumber') || '1');
        setCustomerName("");
        setDate(formatDate(new Date())); // Reset date to current
        // Reset sale items with empty fields, including packsSold, itemsPerPack, quantity, batch and expiry
        setSaleItems([{ product: "", packsSold: '', itemsPerPack: '', quantity: 0, batch: '', expiry: '' }]); // Initialize quantity to 0
         // Clear undo stack when starting a new bill
         setUndoStack([]);
         console.log("Form reset and undo stack cleared."); // Debugging log
    };

    return (
        <div>
            <Header />
            <div className="container mx-auto p-6 bg-white shadow-md rounded-lg">
                 {/* Added links to Dashboard and Product Master */}
                 <div className="flex justify-between mb-4">
                    <Link href="/">
                         {/* Using Button component */}
                        <Button className="bg-purple-500 text-white px-4 py-2 rounded">Go to Dashboard</Button>
                    </Link>
                     <Link href="/product-master">
                         {/* Using Button component */}
                         <Button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">Product Master</Button>
                     </Link>
                 </div>

                <h2 className="text-2xl font-semibold mb-4">
                    {editBill ? "Edit Bill" : "Sales Billing"}
                </h2>

                {/* Bill Header Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Use Input component from shadcn/ui */}
                    <Input
                        type="text"
                        placeholder="Bill Number"
                        className="border p-2 rounded"
                        value={billNumber}
                        readOnly // Bill number is read-only
                    />
                     {/* Use Input component from shadcn/ui */}
                    <Input
                        type="text"
                        placeholder="Customer Name"
                        className="border p-2 rounded"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                    />
                     {/* Use Input component from shadcn/ui */}
                    <Input
                        type="text"
                        className="border p-2 rounded"
                        value={date}
                        onChange={handleDateChange}
                        placeholder="DD-MM-YYYY"
                    />
                </div>

                {/* Sale Items Table */}
                 {/* Added overflow-x-auto for responsiveness */}
                 <div className="overflow-x-auto">
                    <table className="w-full table-auto border mb-6">
                        <thead>
                            {/* Removed whitespace between <th> tags */}
                            <tr className="bg-gray-100">
                                <th className="border px-4 py-2">Index</th>
                                <th className="border px-4 py-2 min-w-[150px]">Product</th>
                                <th className="border px-4 py-2 min-w-[100px]">Packs Sold</th> {/* New header */}
                                <th className="border px-4 py-2 min-w-[100px]">Items per Pack</th> {/* New header */}
                                <th className="border px-4 py-2 min-w-[80px]">Quantity (Items)</th> {/* Clarified unit */}
                                <th className="border px-4 py-2 min-w-[80px]">MRP (per Item)</th> {/* Clarified unit */}
                                <th className="border px-4 py-2 min-w-[120px]">Batch No</th> {/* Added min-width */}
                                <th className="border px-4 py-2 min-w-[120px]">Expiry Date</th> {/* Added min-width */}
                                <th className="border px-4 py-2 min-w-[100px]">Total</th> {/* Added min-width */}
                                <th className="border px-4 py-2 min-w-[80px]">Action</th> {/* Added min-width */}
                            </tr>
                        </thead>
                        <tbody>
                            {saleItems.map((item, index) => (
                                 /* Using index as key is okay if items are not reordered/filtered */
                                <tr key={index}>
                                    <td className="border px-4 py-2 text-center">{index + 1}</td>
                                    <td className="border px-4 py-2 relative">
                                         {/* Use Input component from shadcn/ui */}
                                        <Input
                                            type="text"
                                            placeholder="Product Name"
                                            className="w-full p-1 border rounded" // Adjusted styling to fit within table cell
                                            value={item.product || ""}
                                            onChange={(e) => handleItemChange(index, "product", e.target.value)}
                                            list="product-options" // Connects to the datalist below
                                        />
                                         {/* Datalist for product suggestions from Product Master */}
                                        <datalist id="product-options">
                                            {products.map(p => (
                                                <option key={p.id} value={p.name} />
                                            ))}
                                        </datalist>
                                    </td>
                                     {/* Input for Packs Sold */}
                                    <td className="border px-4 py-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            className="w-full p-1 border rounded" // Adjusted styling
                                            value={item.packsSold === '' ? '' : item.packsSold}
                                            onChange={(e) => handleItemChange(index, 'packsSold', e.target.value)}
                                        />
                                    </td>
                                     {/* Input for Items per Pack (pre-filled from Master) */}
                                    <td className="border px-4 py-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            className="w-full p-1 border rounded" // Adjusted styling
                                            value={item.itemsPerPack === '' ? '' : item.itemsPerPack}
                                            onChange={(e) => handleItemChange(index, 'itemsPerPack', e.target.value)}
                                        />
                                    </td>
                                     {/* Display Calculated Quantity (Individual Items) */}
                                    <td className="border px-4 py-2 text-center font-medium">
                                        {item.quantity}
                                    </td>
                                    <td className="border px-4 py-2 text-right">
                                         {/* Display MRP from Product Master */}
                                        ₹{getProductDetails(item.product)?.mrp?.toFixed(2) || "N/A"}
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                         {/* Input for Batch No - pre-filled from Product Master but editable */}
                                        <Input
                                            type="text"
                                            placeholder="Batch No"
                                            className="w-full p-1 border rounded" // Adjusted styling
                                            value={item.batch || ''}
                                            onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                                        />
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                         {/* Input for Expiry Date - pre-filled from Product Master but editable */}
                                        <Input
                                            type="text"
                                            placeholder="MM-YYYY"
                                            className="w-full p-1 border rounded" // Adjusted styling
                                            value={item.expiry || ''}
                                            onChange={(e) => handleItemChange(index, 'expiry', e.target.value)}
                                        />
                                    </td>
                                    <td className="border px-4 py-2 text-right">
                                         {/* Calculate and display item total */}
                                        ₹{(() => {
                                            const total = calculateRowTotal(item);
                                            return isNaN(total) ? '0.00' : total.toFixed(2); // Display 0.00 for NaN totals
                                        })()}
                                    </td>
                                    <td className="border px-4 py-2 text-center">
                                         {/* Use Button component from shadcn/ui */}
                                        <Button
                                            onClick={() => removeItem(index)}
                                            variant="destructive"
                                            size="sm"
                                            className="bg-red-500 hover:bg-red-600 text-white"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>


                {/* Add Item Button */}
                {/* Use Button component from shadcn/ui */}
                <Button
                    onClick={addItem}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-4"
                >
                    <Plus className="mr-2 h-4 w-4" /> {/* Added Plus icon */}
                    Add Product
                </Button>

                {/* Grand Total Display */}
                <div className="text-right text-xl font-bold">
                    Grand Total: ₹{(() => {
                        const grandTotal = calculateGrandTotal();
                        return isNaN(grandTotal) ? '0.00' : grandTotal.toFixed(2); // Display 0.00 for NaN totals
                    })()}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-4">
                     {/* Use Button component from shadcn/ui */}
                    <Button
                        onClick={handleSaveBill}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {editBill ? "Update Bill" : "Save Bill"}
                    </Button>

                     {/* Undo Button - Note: This undo only reverts stock changes. */}
                     {/* Use Button component from shadcn/ui */}
                    <Button
                        onClick={undoLastAction}
                         // Disable if undo stack is empty
                        disabled={undoStack.length === 0}
                        className={cn(
                            "bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded",
                            undoStack.length === 0 && "opacity-50 cursor-not-allowed" // Style for disabled state
                        )}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" /> {/* Added RotateCcw icon */}
                        Undo Last Stock Change
                    </Button>

                    {/* Wrapped conditional button in a fragment */}
                    {editBill && (
                        <>
                         {/* Use Button component from shadcn/ui */}
                            <Button
                                onClick={resetForm}
                                variant="outline"
                                className="text-gray-700 hover:bg-gray-100 px-4 py-2 rounded"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> {/* Added XCircle icon */}
                                Cancel Edit
                            </Button>
                        </>
                    )}
                </div>

                {/* Search and Bill List Section */}
                <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-2">Search Bills</h3>
                     {/* Use Input component from shadcn/ui */}
                    <Input
                        type="text"
                        placeholder="Search by Bill Number, Customer Name, or Date"
                        className="border p-2 rounded w-full mb-4"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                     {/* Added overflow-x-auto for responsiveness */}
                     <div className="overflow-x-auto">
                        <table className="w-full table-auto border">
                            <thead>
                                {/* Removed whitespace between <th> tags */}
                                <tr className="bg-gray-100">
                                    <th className="border px-4 py-2">Bill Number</th>
                                    <th className="border px-4 py-2">Customer Name</th>
                                    <th className="border px-4 py-2">Date</th>
                                    <th className="border px-4 py-2">Total Amount</th>
                                    <th className="border px-4 py-2 text-center min-w-[150px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Display filtered bills or a "No bills found" message */}
                                {filteredBills.length > 0 ? (
                                    filteredBills.map((bill, index) => (
                                         /* Use a more stable key if possible, but billNumber should be unique */
                                        <tr key={bill.billNumber || index}>
                                            <td className="border px-4 py-2">{bill.billNumber}</td>
                                            <td className="border px-4 py-2">{bill.customerName}</td>
                                            <td className="border px-4 py-2">{bill.date}</td>
                                            <td className="border px-4 py-2">₹{bill.totalAmount.toFixed(2)}</td>
                                            <td className="border px-4 py-2 text-center">
                                                <div className="flex justify-center space-x-2">
                                                     {/* View Details Button (Link) */}
                                                     {/* Note: The original code linked to a separate sales-bill-details page.
                                                         If you want to view details in a modal like in PurchasePage,
                                                         you'll need to implement that modal logic here.
                                                         Keeping the link for now as per the original code. */}
                                                    <Link href={`/sales-bill-details?billNumber=${bill.billNumber}`} passHref>
                                                         {/* Using Button component */}
                                                         <Button variant="link" size="sm" className="text-blue-500 hover:text-blue-700 p-0 h-auto"> {/* Adjusted padding/height */}
                                                             View Details
                                                         </Button>
                                                     </Link>
                                                      {/* Edit Button */}
                                                     {/* Use Button component from shadcn/ui */}
                                                     <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditBill(bill)}
                                                        className="text-yellow-500 hover:text-yellow-700"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                     {/* Delete Button */}
                                                     {/* Use Button component from shadcn/ui */}
                                                     <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteConfirmation(bill)}
                                                        className="bg-red-500 hover:bg-red-600 text-white"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                         {/* Adjusted colSpan */}
                                        <td colSpan="5" className="border px-4 py-2 text-center">
                                            No bills found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                </div>

                {/* Delete Confirmation Dialog */}
                 {/* Using shadcn/ui Dialog components */}
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>
                                <AlertCircle className="inline-block h-5 w-5 mr-2 text-red-500" />
                                Delete Bill
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete bill number {billToDelete?.billNumber}?
                                This action cannot be undone. Deleting a sales bill will add the items' quantities back to stock.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                             {/* Use Button component from shadcn/ui */}
                            <Button variant="secondary" onClick={handleCloseDeleteDialog}>
                                Cancel
                            </Button>
                             {/* Use Button component from shadcn/ui */}
                            <Button
                                variant="destructive"
                                onClick={handleDeleteBill}
                                className="bg-red-500 hover:bg-red-600 text-white"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default SalesPage;
