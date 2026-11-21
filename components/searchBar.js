import { styled, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import { useDebouncedCallback } from 'use-debounce';


// Props (todas opcionales salvo setFilter; el uso existente `<SearchAppBar setFilter={...} />` no cambia):
//   onEnter(value): se llama al pulsar Enter (por ejemplo, el escáner USB lo envía al terminar un código).
//                   Antes de llamarlo se aplica el filtro pendiente del debounce.
//   placeholder, autoFocus, inputRef.
export default function SearchAppBar({ setFilter, onEnter, placeholder = 'Buscar...', autoFocus = false, inputRef }) {

  const handleSearch = useDebouncedCallback((value) => {
    setFilter(value)
  }, 300);
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Search>
        <SearchIconWrapper>
          <SearchIcon />
        </SearchIconWrapper>
        <StyledInputBase
          onChange={(event) => {
            handleSearch(event.target.value);
          }
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onEnter) {
              handleSearch.flush();
              onEnter(event.target.value);
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputRef={inputRef}
          inputProps={{ 'aria-label': 'search' }}
        />
      </Search>
    </Box>
  );
}
const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: "#F8F8F8",
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: '100%',
  },
}));
const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));
const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('sm')]: {
      width: '100%',
      '&:focus': {
        width: '100%',
      },
    },
  },
}));