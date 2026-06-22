const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c)=>c.charCodeAt(0));
Deno.serve(()=>new Response(PNG, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60"
    }
  }));
