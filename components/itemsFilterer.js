import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { useDebouncedCallback } from 'use-debounce';
import { TIPOS } from '../lib/constants/tipos';


const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const filterTypeNames = TIPOS;

function getStyles(filter, filterName, theme) {
  return {
    fontWeight:
      filterName.indexOf(filter) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

export default function ItemsFilterer({ setFilters, filters }) {
  const theme = useTheme();

  const handleSearch = useDebouncedCallback((event) => {
    const {
      target: { value },
    } = event;
    setFilters(
      typeof value === 'string' ? value.split(',') : value,
    );
  }, 10);

  const handleChange = (event) => {
    handleSearch(event);
  };

  return (
    // Mismo formato que la barra de búsqueda: 48 px de alto, fondo tonal, esquinas de 16 px y sin borde hasta enfocar
    <FormControl
      sx={{
        m: 0, width: '100%',
        '& .MuiOutlinedInput-root': {
          height: 48, borderRadius: '16px', bgcolor: '#E9EEF6', transition: 'background-color .2s',
          '&:hover': { bgcolor: '#E1E9F5' },
          '&.Mui-focused': { bgcolor: '#fff' },
          '& fieldset': { border: '2px solid transparent' },
          '&.Mui-focused fieldset': { borderColor: '#0B57D0', borderWidth: 2 },
        },
        '& .MuiSelect-select': { fontSize: '1rem' },
      }}
    >
      <Select
        id="demo-multiple-filter"
        multiple
        displayEmpty
        value={filters}
        onChange={handleChange}
        input={<OutlinedInput />}
        inputProps={{ 'aria-label': 'Filtrar por tipo' }}
        renderValue={(sel) => (sel.length ? sel.join(', ') : <span style={{ color: 'rgba(0,0,0,.6)' }}>Filtrar por tipo</span>)}
        MenuProps={MenuProps}
      >
        {filterTypeNames.map((filter) => (
          <MenuItem
            key={filter}
            value={filter}
            style={getStyles(filter, filters, theme)}
          >
            {filter}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}