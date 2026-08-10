import {type CustomerUpdate, type CustomerMutation, type Customer } from "../domain/customer.ts";

export class CustomerHttpClient {
    private baseUrl: string;
    
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async listCustomers(): Promise<Customer[]> {
        const response = await fetch(`${this.baseUrl}/customers`);
        return response.json() as Promise<Customer[]>;
    }

    async createCustomer(customer: Omit<Customer, '_id'>): Promise<CustomerMutation> {
        const response = await fetch(`${this.baseUrl}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customer)
        });
        return response.json() as Promise<CustomerMutation>;
    }

    async getCustomerById(id: string): Promise<Customer | null> {
        const response = await fetch(`${this.baseUrl}/customers/${id}`);
        if (response.status === 404) {
            return null;
        }
        return response.json() as Promise<Customer>;
    }

    async updateCustomer(customer: CustomerUpdate): Promise<CustomerMutation> {
        const {_id, ...remaining } = customer
        const response = await fetch(`${this.baseUrl}/customers/${customer._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(remaining)
        });
        return response.json() as Promise<CustomerMutation>;
    }

    async deleteCustomer(id: string): Promise<CustomerMutation> {
        const response = await fetch(`${this.baseUrl}/customers/${id}`, {
            method: 'DELETE'
        });
        return response.json() as Promise<CustomerMutation>;
    }
}