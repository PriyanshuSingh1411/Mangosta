import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/app/lib/dataStore";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Order ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Verify the logged-in customer.
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
          error: "Please sign in to view this order.",
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
     * Load all orders.
     */
    const orders = await getOrders();

    /*
     * Find the requested order AND verify that
     * it belongs to the logged-in customer.
     */
    const order = orders.find((item) => {
      const orderEmail = String(
        item.customer?.email || ""
      )
        .trim()
        .toLowerCase();

      return (
        item.id === id &&
        orderEmail === customerEmail
      );
    });

    if (!order) {
      return NextResponse.json(
        {
          error: "Order not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        order,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET /api/orders/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to load order.",
      },
      {
        status: 500,
      }
    );
  }
}