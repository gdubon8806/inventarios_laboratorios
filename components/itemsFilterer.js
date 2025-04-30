import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { alignProperty } from '@mui/material/styles/cssUtils';

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

const filters = [
  'Suministro',
  'Herramienta',
  'Mobiliario',
  'Equipo',
];

function getStyles(filter, filterName, theme) {
  return {
    fontWeight:
      filterName.indexOf(filter) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

export default function ItemsFilterer({setFilters}) {
  const theme = useTheme();

  const [filterName, setfilterName] = React.useState([]);

  setFilters(filterName)

  const handleChange = (event) => {
    const {
      target: { value },
    } = event;
    setfilterName(
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  return (
      <FormControl sx={{ m: 1, width: 300, padding: '0.40rem'}}>
        <InputLabel id="demo-multiple-filter-label">Filtros</InputLabel>
        <Select
          labelId="demo-multiple-filter-label"
          id="demo-multiple-filter"
          multiple
          value={filterName}
          onChange={handleChange}
          input={<OutlinedInput label="filter" />}
          MenuProps={MenuProps}
          style={{height: '40px'}}
        >
          {filters.map((filter) => (
            <MenuItem
              key={filter}
              value={filter}
              style={getStyles(filter, filterName, theme)}
            >
              {filter}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
  );
}