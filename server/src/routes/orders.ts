import type { FastifyPluginAsync } from 'fastify';
import { OrdersService, type OrderMutation } from '../services/orders.ts';

const routes: FastifyPluginAsync = async (fastify) => {
  const service = new OrdersService(fastify.db);
  fastify.get('/customers', async (request) => {
    const includeInactive=(request.query as {includeInactive?:string}).includeInactive==='true';
    return service.listCustomers(includeInactive);
  });
  fastify.post<{Body:{id:string;name:string;phone?:string;notes?:string}}>('/customers',async(request,reply)=>{
    try{return reply.code(201).send(service.saveCustomer(request.body));}
    catch(error){const message=error instanceof Error?error.message:'INVALID_CUSTOMER';return reply.code(400).send({error:'Bad Request',message});}
  });
  fastify.get('/orders',async(request)=>{
    const q=request.query as {customerId?:string;from?:string;to?:string;search?:string};
    return service.listOrders(q);
  });
  fastify.get<{Params:{id:string}}>('/orders/:id',async(request,reply)=>{
    const order=service.getOrder(request.params.id);
    return order??reply.code(404).send({error:'Not Found',message:'Order not found'});
  });
  fastify.post<{Body:{mutations:OrderMutation[]}}>('/orders/sync',async(request,reply)=>{
    const mutations=request.body?.mutations;
    if(!Array.isArray(mutations)||mutations.length<1||mutations.length>100) return reply.code(400).send({error:'Bad Request',message:'mutations must contain 1-100 entries'});
    const results=[];
    for(const mutation of mutations){
      try{results.push({mutationId:mutation?.mutationId,...service.applyMutation(mutation)});}
      catch(error){const message=error instanceof Error?error.message:'INVALID_MUTATION';return reply.code(400).send({error:'Bad Request',message,mutationId:mutation?.mutationId});}
    }
    return {results};
  });
};
export default routes;
