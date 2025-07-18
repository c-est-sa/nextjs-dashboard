"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { redirect } from "next/navigation";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(["pending", "paid"]),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const rawFormData = {
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  };

  const { customerId, amount, status } = CreateInvoice.parse(rawFormData);
  const amountInCents = amount * 100; // To avoid JavaScript floating-point errors
  const date = new Date().toISOString().split("T")[0]; // create a new date with the format "YYYY-MM-DD" for the invoice's creation date

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    console.error("Error creating invoice:", error);
  }

  // Revalidate clears the cache and trigger a new request to the server to fetch the latest data.
  // Once the database has been updated, the /dashboard/invoices path will be revalidated.
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
  // redirect would only be reachable if try is successful.
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    console.error("Error updating invoice:", error);
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  // throw new Error("Failed to Delete Invoice");

  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}
