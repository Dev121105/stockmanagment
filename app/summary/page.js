// app/summary/page.js
"use client"; // This directive is needed for client-side functionality

import { useState, useEffect, useMemo } from "react"; // Import useMemo
// Adjust path if needed - assuming TotalSummary is in the 'components' folder
import TotalSummary from "../components/TotalSummary";
import Header from "../components/Header";
// Import toast for error messages
import { toast } from 'sonner';


// Helper function to load products from localStorage and ensure data types
// This is a robust version similar to the one used on the dashboard
const loadProductsFromLocalStorage = () => {
    console.log("SummaryPage: Attempting to load products from localStorage..."); // Debugging log
    try {
        const storedProducts = localStorage.getItem("products");
        console.log("SummaryPage: localStorage 'products' raw data:", storedProducts ? storedProducts.substring(0, 500) + (storedProducts.length > 500 ? '...' : '') : 'null'); // Debugging log

        const products = storedProducts ? JSON.parse(storedProducts) : [];
        console.log("SummaryPage: Successfully parsed products. Count:", products.length); // Debugging log

        // Process each product item to ensure correct types, adding robustness
        const processedProducts = products.map(p => {
            try {
                 // Ensure these fields are numbers for calculations
                 // Use defaults that make sense if data is missing or invalid
                 return {
                     ...p,
                     // Key fields for summary calculation
                     quantity: Number(p.quantity) || 0, // Ensure quantity is number, default to 0
                     mrp: Number(p.mrp) || 0, // Ensure mrp is number, default to 0 (used for value calculation)

                     // Other fields needed for potential future display or consistency
                     itemsPerPack: Number(p.itemsPerPack) || 1,
                     minStock: Number(p.minStock) || 0,
                     maxStock: Number(p.maxStock) || 0,
                     discount: Number(p.discount) || 0,
                     taxRate: Number(p.taxRate) || 0,
                     name: p.name || '',
                     unit: p.unit || '',
                     category: p.category || '',
                     company: p.company || '',
                      expiry: p.expiry || '', // Keeping expiry as string
                      batch: p.batch || '', // Keeping batch as string
                 };
            } catch (mapErr) {
                console.error("SummaryPage: Error processing product item during map:", p, mapErr);
                 // If a specific item fails processing, return null or a minimal structure
                 return null; // Return null and filter it out
            }
        }).filter(p => p !== null); // Filter out any items that failed processing

        console.log("SummaryPage: Finished processing products. Valid product count:", processedProducts.length); // Debugging log
        return processedProducts; // Return the array of processed products

    } catch (err) {
        console.error("SummaryPage: Error loading or parsing products from localStorage:", err);
        // Show a toast notification if loading fails
        toast.error("Error loading product data for summary.");
        return []; // Return empty array on any error during load/parse
    }
};


export default function SummaryPage() {
   const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true); // Add loading state


   // Load initial data and set up event listener for product updates
   useEffect(() => {
        console.log("SummaryPage useEffect: Component mounted. Starting data load."); // Debugging log
     const initialProducts = loadProductsFromLocalStorage();
        console.log("SummaryPage useEffect: Products loaded from storage.", initialProducts.length); // Debugging log
     setProducts(initialProducts);
        console.log("SummaryPage useEffect: Products state updated."); // Debugging log
        setLoading(false); // Set loading to false after initial load

        // Listen for product updates from other pages (Product Master, Purchase, Sales)
     const handleProductsUpdated = () => {
       console.log("SummaryPage: 'productsUpdated' event received. Reloading products for summary."); // Debugging log
       const updatedProducts = loadProductsFromLocalStorage(); // This already logs internally
       setProducts(updatedProducts); // Update products state to trigger totals recalculation
     };

        console.log("SummaryPage useEffect: Adding 'productsUpdated' event listener."); // Debugging log
     window.addEventListener('productsUpdated', handleProductsUpdated);

        // Clean up event listener when the component unmounts
     return () => {
            console.log("SummaryPage useEffect: Component unmounting. Removing event listener."); // Debugging log
       window.removeEventListener('productsUpdated', handleProductsUpdated);
     };

   }, []); // Empty dependency array means this runs only once on mount

   // Calculate totals whenever the products state changes using useMemo
    const totalQuantity = useMemo(() => {
        console.log("SummaryPage useMemo: Calculating total quantity...");
        return products.reduce((sum, product) => {
            // Ensure quantity is a number before adding
            return sum + (Number(product.quantity) || 0);
        }, 0);
    }, [products]); // Recalculate when products change


    const totalValue = useMemo(() => {
        console.log("SummaryPage useMemo: Calculating total value...");
        return products.reduce(
            (sum, product) => {
                // Ensure quantity and mrp are numbers before multiplying and adding
                const quantity = Number(product.quantity) || 0;
                const mrp = Number(product.mrp) || 0; // Use mrp from Product Master for value
                // Assuming MRP is per pack and quantity is in items, divide MRP by itemsPerPack
                const itemsPerPack = Number(product.itemsPerPack) || 1;
                const valuePerItem = (itemsPerPack > 0) ? (mrp / itemsPerPack) : mrp;

                return sum + (quantity * valuePerItem);
            },
            0
        );
    }, [products]); // Recalculate when products change


   return (
     <> {/* Use Fragment instead of div if Header is not wrapped in div */}
       <Header/>
       <div className="container mx-auto p-6"> {/* Added container and padding */}
           <h1 className="text-2xl font-semibold mb-4">Overall Stock Summary</h1> {/* Updated title and styling */}

                {/* Show loading message or the summary */}
                {loading ? (
                    <div className="text-center text-gray-500">Loading summary data...</div>
                ) : (
                    // Pass the calculated totals to the TotalSummary component as the correct props
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Use a grid for layout */}
                         <TotalSummary
                             title="Total Stock Quantity" // Title for quantity
                             value={totalQuantity.toLocaleString()} // Format quantity
                             description="Total number of items across all products"
                             bgColor="bg-blue-500" // Example color
                         />
                         <TotalSummary
                             title="Total Stock Value (Current MRP)" // Title for value
                             value={`₹${totalValue.toFixed(2)}`} // Format value with currency
                             description="Value of current inventory based on latest Master MRP"
                             bgColor="bg-green-500" // Example color
                         />
                    </div>
                )}

       </div>
     </>
  );
}
