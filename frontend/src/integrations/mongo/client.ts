// Simple local storage-based data persistence
// This replaces database operations with localStorage for client-side storage

export async function getDb() {
  // Return a mock database interface that uses localStorage
  return {
    collection: (name: string) => ({
      findOne: async (query: any) => {
        const data = localStorage.getItem(`db_${name}`);
        if (!data) return null;
        const items = JSON.parse(data);
        // Simple query matching (just check if all query properties match)
        return items.find((item: any) =>
          Object.keys(query).every(key => item[key] === query[key])
        ) || null;
      },

      find: async (query: any = {}) => {
        const data = localStorage.getItem(`db_${name}`);
        if (!data) return [];
        const items = JSON.parse(data);
        if (Object.keys(query).length === 0) return items;
        // Simple query filtering
        return items.filter((item: any) =>
          Object.keys(query).every(key => item[key] === query[key])
        );
      },

      insertOne: async (doc: any) => {
        const data = localStorage.getItem(`db_${name}`) || '[]';
        const items = JSON.parse(data);
        const newDoc = { ...doc, _id: Date.now().toString() };
        items.push(newDoc);
        localStorage.setItem(`db_${name}`, JSON.stringify(items));
        return { acknowledged: true, insertedId: newDoc._id };
      },

      updateOne: async (filter: any, update: any) => {
        const data = localStorage.getItem(`db_${name}`);
        if (!data) return { acknowledged: false, matchedCount: 0, modifiedCount: 0 };
        const items = JSON.parse(data);
        const index = items.findIndex((item: any) =>
          Object.keys(filter).every(key => item[key] === filter[key])
        );
        if (index === -1) return { acknowledged: false, matchedCount: 0, modifiedCount: 0 };

        // Apply update operations
        if (update.$set) {
          items[index] = { ...items[index], ...update.$set };
        }
        localStorage.setItem(`db_${name}`, JSON.stringify(items));
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
      },

      deleteOne: async (filter: any) => {
        const data = localStorage.getItem(`db_${name}`);
        if (!data) return { acknowledged: false, deletedCount: 0 };
        const items = JSON.parse(data);
        const filteredItems = items.filter((item: any) =>
          !Object.keys(filter).every(key => item[key] === filter[key])
        );
        const deletedCount = items.length - filteredItems.length;
        localStorage.setItem(`db_${name}`, JSON.stringify(filteredItems));
        return { acknowledged: true, deletedCount };
      }
    })
  };
}
