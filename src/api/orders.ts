import { apiRequest } from './client';
import type { LocalCustomer, PendingMutation } from '@/lib/orders-db';
const headers={'content-type':'application/json'};
export function syncCustomer(customer:LocalCustomer){return apiRequest('/customers',{method:'POST',headers,body:JSON.stringify(customer)});}
export function syncMutations(mutations:PendingMutation[]){return apiRequest<{results:{mutationId:string;status:'applied'|'duplicate'|'conflict';order?:any;current?:any}[]}>('/orders/sync',{method:'POST',headers,body:JSON.stringify({mutations})});}
export function fetchCustomers(){return apiRequest<LocalCustomer[]>('/customers');}
