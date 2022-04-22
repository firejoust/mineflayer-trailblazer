module.exports = class {
    static createBuffer(client) {
        return client.world.getColumns().map(column => {
            return {
                chunk_x: column.chunkX,
                chunk_y: column.chunkY,
                sections: column.column.sections.map(section => {
                    return {
                        palette: section.palette,
                        data: section.data.data.data,
                        max_bits: section.data.maxBits,
                        bits_per_value: section.data.data.bitsPerValue,
                        values_per_long: section.data.data.valuesPerLong,
                        value_mask: section.data.data.valueMask,
                        capacity: section.data.data.capacity
                    }
                })
            }
        })
    }
}