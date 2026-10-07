import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/app/lib/dataStore";

export async function GET(request: NextRequest) {
  try {
    /*
     * Forward the customer's existing authentication cookie
     * to the existing /api/auth/me endpoint.
     */
    const authResponse = await fetch(
      `${request.nextUrl.origin}/api/auth/me`,
      {
        method: "GET",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      }
    );

    const authData = await authResponse
      .json()
      .catch(() => null);

    if (!authResponse.ok || !authData?.user?.email) {
      return NextResponse.json(
        {
          error: "Please sign in to view your orders.",
        },
        {
          status: 401,
        }
      );
    }

    const customerEmail = String(
      authData.user.email
    )
      .trim()
      .toLowerCase();

    /*
     * Get every order from the existing order store.
     */
    const orders = await getOrders();

    /*
     * Only return orders belonging to the logged-in customer.
     *
     * This includes:
     * - old/previous orders
     * - currently processing orders
     * - fulfilled orders
     * - all future orders placed by this customer
     */
    const customerOrders = orders
      .filter((order) => {
        const orderEmail = String(
          order.customer?.email || ""
        )
          .trim()
          .toLowerCase();

        return orderEmail === customerEmail;
      })
      .sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      });

    return NextResponse.json(
      {
        orders: customerOrders,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET /api/orders error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to load orders.",
      },
      {
        status: 500,
      }
    );
  }
}