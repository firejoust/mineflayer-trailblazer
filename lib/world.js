module.exports = class {
    static createBuffer(client) {
        return client.world.getColumns().map(column => 
            column.column.sections.map(section => {
                return {
                    palette: section.palette,
                    data: section.data.data.data,
                    maxBits: section.data.maxBits,
                    bitsPerValue: section.data.data.bitsPerValue,
                    valuesPerLong: section.data.data.valuesPerLong,
                    valueMask: section.data.data.valueMask,
                    capacity: section.data.data.capacity
                }
            })
        );
    }
}