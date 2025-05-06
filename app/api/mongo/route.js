import { MongoClient } from'mongodb';
import { NextResponse } from 'next/server';

export async function GET(request, response) {


// Replace the uri string with your connection string
const uri = "mongodb+srv://<db_username>:stock@example@cluster0.eshdjqu.mongodb.net/";

const client = new MongoClient(uri);


  try {
    const database = client.db('inventory');
    const stock = database.collection('stock');

    // Queries for a movie that has a title value of 'Back to the Future'
    const query = {  };
    const movie = await stock.find(query).toArray();

    console.log(movie);
    return  NextResponse.json({"a":34,stock})
  } finally {
    await client.close();
  }
}