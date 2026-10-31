"""Trusted caller selects profile; artifact metadata never authorizes production."""
def indexing_profile(value='preview'):
    if value not in ('preview', 'production'):
        raise ValueError('invalid indexing profile')
    return value
